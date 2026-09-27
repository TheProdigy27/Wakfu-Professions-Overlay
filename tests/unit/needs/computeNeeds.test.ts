import { describe, expect, it } from 'vitest';
import { loadIndex } from '../../../src/core/data/loadIndex';
import { computeNeeds, recipesUsed, resolveRecipe, type NeedNode } from '../../../src/core/needs/computeNeeds';
import { craftOrder } from '../../../src/core/needs/craftOrder';
import { shoppingList } from '../../../src/core/needs/shopping';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';
import { indexFile } from '../../helpers/synthetic';

const { index } = loadFixture();
const find = (node: NeedNode, key: string): NeedNode | undefined =>
  node.key === key ? node : node.children.map((c) => find(c, key)).find(Boolean);

describe('computeNeeds', () => {
  it('donne à chaque nœud une clé stable : le chemin des itemId', () => {
    const res = computeNeeds(index, { targets: [{ itemId: IDS.COIFFE_L, qty: 1 }] });
    const root = res.roots[0]!;
    expect(root.key).toBe(`${IDS.COIFFE_L}`);
    const orbeUnderM = find(root, `${IDS.COIFFE_L}/${IDS.COIFFE_M}/${IDS.ORBE}`);
    expect(orbeUnderM).toMatchObject({ kind: 'craft', crafts: 2, qty: 2 });
    expect(root.recipe?.isUpgrade).toBe(true);
  });

  it('traite un objet non craftable pris comme cible', () => {
    const res = computeNeeds(index, { targets: [{ itemId: IDS.POUDRE, qty: 3 }] });
    expect(res.roots[0]).toMatchObject({ kind: 'base', toObtain: 3, crafts: 0, children: [] });
    expect(shoppingList(index, res, { targets: [] }).resources).toEqual([
      { itemId: IDS.POUDRE, required: 3, owned: 0, missing: 3 },
    ]);
  });

  it("marque « stock » un objet entièrement possédé, sans descendre dans sa recette", () => {
    const input = { targets: [{ itemId: IDS.ORBE, qty: 2 }], owned: { [IDS.ORBE]: 5 } };
    const res = computeNeeds(index, input);
    expect(res.roots[0]).toMatchObject({ kind: 'stock', fromStock: 2, children: [] });
    expect(res.leftover.get(IDS.ORBE)).toBe(3);
  });

  it("ignore les quantités possédées nulles ou négatives", () => {
    const res = computeNeeds(index, { targets: [{ itemId: IDS.ORBE, qty: 1 }], owned: { [IDS.ORBE]: 0, [IDS.POUDRE]: -4 } });
    expect(res.totals.get(IDS.ORBE)).toMatchObject({ fromStock: 0, crafts: 1 });
    expect(res.leftover.size).toBe(0);
  });

  it("« j'achète » sur la cible elle-même", () => {
    const input = { targets: [{ itemId: IDS.ORBE, qty: 2 }], mode: { [IDS.ORBE]: 'buy' as const } };
    const res = computeNeeds(index, input);
    expect(res.roots[0]).toMatchObject({ kind: 'buy', toObtain: 2 });
    expect(shoppingList(index, res, input).bought).toEqual([{ itemId: IDS.ORBE, required: 2, owned: 0, missing: 2 }]);
  });

  it('partage le stock et le surplus entre plusieurs cibles', () => {
    // Pain de Farle : rendement 4 → un seul craft couvre deux cibles de 2.
    const res = computeNeeds(index, {
      targets: [
        { itemId: IDS.PAIN_FARLE, qty: 2 },
        { itemId: IDS.PAIN_FARLE, qty: 2 },
      ],
    });
    expect(res.roots.map((r) => r.kind)).toEqual(['craft', 'stock']);
    expect(res.totals.get(IDS.PAIN_FARLE)).toMatchObject({ demand: 4, crafts: 1, fromStock: 2 });
    expect(res.leftover.has(IDS.PAIN_FARLE)).toBe(false);
  });

  it('revient à la recette par défaut si la variante choisie est invalide', () => {
    const defaultId = index.recipesByItem.get(IDS.ORBE)![0]!.id;
    const breadRecipe = index.recipesByItem.get(IDS.PAIN_COMPLET)![0]!.id;
    expect(resolveRecipe(index, { targets: [], recipeChoice: { [IDS.ORBE]: 999999 } }, IDS.ORBE)?.id).toBe(defaultId);
    expect(resolveRecipe(index, { targets: [], recipeChoice: { [IDS.ORBE]: breadRecipe } }, IDS.ORBE)?.id).toBe(defaultId);
    expect(resolveRecipe(index, { targets: [], recipeChoice: { [IDS.ORBE]: 7362 } }, IDS.ORBE)?.id).toBe(7362);
  });

  it('coupe un cycle A → B → A et le signale', () => {
    const cyc = loadIndex(
      indexFile({
        items: [
          [1, 'A', 1, 1, 0, 0],
          [2, 'B', 1, 1, 0, 0],
          [3, 'X', 1, 1, 0, 0],
        ],
        recipes: [
          [10, 1, 1, 0, 1, 1, [2, 2]],
          [11, 1, 1, 0, 2, 1, [1, 1, 3, 3]],
        ],
      }),
      'fr',
    );
    const res = computeNeeds(cyc, { targets: [{ itemId: 1, qty: 1 }] });
    const cycleNode = res.roots[0]!.children[0]!.children[0]!;
    expect(cycleNode).toMatchObject({ itemId: 1, kind: 'cycle', toObtain: 2, key: '1/2/1' });
    expect(res.totals.get(3)?.toObtain).toBe(6);
    // A est crafté (racine) et à obtenir (cycle) : il figure aussi dans les ressources.
    expect(shoppingList(cyc, res, { targets: [] }).resources.map((l) => l.itemId)).toEqual([1, 3]);
    expect(craftOrder(cyc, res).map((s) => s.itemId)).toEqual([2, 1]);
  });

  it("signale un ingrédient absent de l'index et le range dans les ressources", () => {
    const idx = loadIndex(
      indexFile({
        items: [
          [1, 'Pain', 1, 1, 0, 0],
          [2, 'Farine', 1, 1, 0, 0],
        ],
        recipes: [[10, 1, 1, 0, 1, 1, [2, 1, 999, 2]]],
      }),
      'fr',
    );
    const input = { targets: [{ itemId: 1, qty: 1 }] };
    const res = computeNeeds(idx, input);
    expect(res.unknownItemIds).toEqual([999]);
    expect(find(res.roots[0]!, '1/999')).toMatchObject({ kind: 'base', toObtain: 2 });
    // Tri par nom : « #999 » (sans nom) avant « Farine ».
    expect(shoppingList(idx, res, input).resources.map((l) => l.itemId)).toEqual([999, 2]);
  });
});

describe('shoppingList', () => {
  const input = { targets: [{ itemId: IDS.COIFFE_L, qty: 1 }], owned: { 27093: 30 } };

  it("garde les ressources entièrement possédées (reste 0), sauf avec « seulement ce qui manque »", () => {
    const res = computeNeeds(index, input);
    const all = shoppingList(index, res, input);
    expect(all.resources.find((l) => l.itemId === IDS.POUDRE)).toEqual({ itemId: IDS.POUDRE, required: 21, owned: 30, missing: 0 });
    const missing = shoppingList(index, res, input, { missingOnly: true });
    expect(missing.resources.some((l) => l.itemId === IDS.POUDRE)).toBe(false);
  });

  it('exclut les intermédiaires craftés et trie par nom', () => {
    const res = computeNeeds(index, input);
    const { resources, bought } = shoppingList(index, res, input);
    expect(bought).toEqual([]);
    expect(resources.some((l) => index.recipesByItem.has(l.itemId))).toBe(false);
    const names = resources.map((l) => index.items.get(l.itemId)!.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
  });
});

describe('craftOrder', () => {
  it('départage par métier, niveau puis id ; métier inconnu en premier', () => {
    const idx = loadIndex(
      indexFile({
        jobs: [
          [1, 'Tailleur'],
          [2, 'Bijoutier'],
        ],
        items: [1, 2, 3, 4, 5, 9].map((id) => [id, `O${id}`, 1, 1, 0, 0] as [number, string, number, number, number, number]),
        recipes: [
          [11, 1, 20, 0, 1, 1, [9, 1]],
          [12, 1, 10, 0, 2, 1, [9, 1]],
          [13, 2, 50, 0, 3, 1, [9, 1]],
          [14, 7, 1, 0, 4, 1, [9, 1]], // métier 7 absent de l'index
          [15, 1, 10, 0, 5, 1, [9, 1]],
        ],
      }),
      'fr',
    );
    const res = computeNeeds(idx, { targets: [1, 2, 3, 4, 5].map((itemId) => ({ itemId, qty: 1 })) });
    expect(craftOrder(idx, res).map((s) => s.itemId)).toEqual([4, 3, 2, 5, 1]);
  });
});

describe('recipesUsed', () => {
  it('mémorise la recette utilisée par chaque objet crafté (snapshot)', () => {
    const res = computeNeeds(index, { targets: [{ itemId: IDS.COIFFE_L, qty: 1 }], recipeChoice: { [IDS.ORBE]: 7362 } });
    const snap = recipesUsed(res);
    expect(Object.keys(snap).map(Number).sort((a, b) => a - b)).toEqual(
      [IDS.FIBRE, IDS.FIL, IDS.ORBE, IDS.COIFFE_M, IDS.COIFFE_L].sort((a, b) => a - b),
    );
    const orbe = index.recipes.get(7362)!;
    expect(snap[IDS.ORBE]).toEqual({ recipeId: 7362, yield: orbe.yield, ings: orbe.ings.flatMap((g) => [g.itemId, g.qty]) });
  });
});
