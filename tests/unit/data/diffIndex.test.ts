import { describe, expect, it } from 'vitest';
import { describeChange, diffSnapshot } from '../../../src/core/data/diffIndex';
import type { GameIndexFile, ItemTuple } from '../../../src/core/data/indexFile';
import { loadIndex } from '../../../src/core/data/loadIndex';
import { computeNeeds, recipesUsed } from '../../../src/core/needs/computeNeeds';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';
import { indexFile } from '../../helpers/synthetic';

describe('diffSnapshot', () => {
  const { file, index } = loadFixture();
  const snapshot = recipesUsed(computeNeeds(index, { targets: [{ itemId: IDS.COIFFE_L, qty: 1 }] }));

  it('ne signale rien quand les données sont identiques', () => {
    expect(diffSnapshot(snapshot, index)).toEqual([]);
  });

  it('signale une quantité modifiée, dans les termes du bandeau', () => {
    const krak = [...index.items.values()].find((i) => i.name === 'Krak-Ertz')!.id;
    const modified: GameIndexFile = structuredClone(file);
    const r6446 = modified.recipes.find((r) => r[0] === 6446)!;
    const at = r6446[6].indexOf(krak);
    expect(r6446[6][at + 1]).toBe(7);
    r6446[6][at + 1] = 8;
    const changes = diffSnapshot(snapshot, loadIndex(modified));
    expect(changes).toEqual([
      { kind: 'recipe-changed', itemId: IDS.ORBE, recipeId: 6446, ings: [{ itemId: krak, before: 7, after: 8 }] },
    ]);
    expect(describeChange(changes[0]!, index)).toBe('Orbe Durable : Krak-Ertz 7 → 8');
  });

  it('signale une recette ou un objet disparus', () => {
    const modified: GameIndexFile = structuredClone(file);
    modified.recipes = modified.recipes.filter((r) => r[4] !== IDS.FIL && r[4] !== IDS.FIBRE);
    modified.items = modified.items.filter((i) => i[0] !== IDS.FIBRE);
    const next = loadIndex(modified);
    const changes = diffSnapshot(snapshot, next);
    const filRecipe = snapshot[IDS.FIL]!.recipeId;
    expect(changes).toEqual([
      { kind: 'item-removed', itemId: IDS.FIBRE },
      { kind: 'recipe-removed', itemId: IDS.FIL, recipeId: filRecipe },
    ]);
    expect(describeChange(changes[0]!, next)).toBe(`Objet #${IDS.FIBRE} : objet retiré du jeu`);
    expect(describeChange(changes[1]!, next)).toBe(
      "Fil Durable : la recette choisie n'existe plus, recette par défaut utilisée",
    );
  });

  it('décrit rendement, ingrédient ajouté et ingrédient retiré', () => {
    const before = loadIndex(
      indexFile({
        items: [
          [1, 'Pain', 1, 1, 0, 0],
          [2, 'Farine', 1, 1, 0, 0],
          [3, 'Levure', 1, 1, 0, 0],
          [4, 'Sel', 1, 1, 0, 0],
        ],
        recipes: [[10, 1, 1, 0, 1, 1, [2, 3, 3, 1]]],
      }),
    );
    const snap = recipesUsed(computeNeeds(before, { targets: [{ itemId: 1, qty: 1 }] }));
    const items = [...before.items.values()].map((i): ItemTuple => [i.id, i.name, 1, 1, 0, 0]);
    const after = loadIndex(indexFile({ items, recipes: [[10, 1, 1, 0, 1, 4, [2, 3, 4, 2]]] }));
    const [change] = diffSnapshot(snap, after);
    expect(change).toEqual({
      kind: 'recipe-changed',
      itemId: 1,
      recipeId: 10,
      yield: { before: 1, after: 4 },
      ings: [
        { itemId: 3, before: 1, after: 0 },
        { itemId: 4, before: 0, after: 2 },
      ],
    });
    expect(describeChange(change!, after)).toBe('Pain : rendement 1 → 4, Levure retiré (×1), Sel ajouté (×2)');
  });
});
