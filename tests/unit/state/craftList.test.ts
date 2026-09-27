import { describe, expect, it } from 'vitest';
import { computeNeeds, type NeedNode } from '../../../src/core/needs/computeNeeds';
import { shoppingList } from '../../../src/core/needs/shopping';
import {
  addOwned,
  chooseRecipe,
  hasAll,
  MAX_HISTORY,
  MAX_QTY,
  needsInput,
  newList,
  pushHistory,
  setMissingOnly,
  setMode,
  setOwned,
  setTargetQty,
  setView,
  toggleCollapsed,
  toggleHave,
  treeItemIds,
  type CraftList,
} from '../../../src/core/state/craftList';
import { withSnapshot } from '../../../src/core/state/reconcile';
import { loadFixture } from '../../helpers/fixture';
import { IDS, needsCases, observe } from '../../helpers/needsCases';

const { index } = loadFixture();
const t0 = new Date('2026-09-26T10:00:00Z');
const t1 = new Date('2026-09-26T10:05:00Z');
const coiffe = () => newList(IDS.COIFFE_L, index.version, {}, t0, 'liste-1');
const nodes = (list: CraftList, itemId: number): NeedNode[] => {
  const out: NeedNode[] = [];
  const walk = (n: NeedNode) => {
    if (n.itemId === itemId) out.push(n);
    n.children.forEach(walk);
  };
  computeNeeds(index, needsInput(list)).roots.forEach(walk);
  return out;
};
const demandOf = (list: CraftList, itemId: number) => computeNeeds(index, needsInput(list)).totals.get(itemId)!.demand;

describe('newList', () => {
  it('repart de zéro, avec les variantes mémorisées', () => {
    expect(newList(IDS.ORBE, '1.93.1.62', { [IDS.ORBE]: 7362 }, t0, 'id')).toEqual({
      id: 'id',
      createdAt: t0.toISOString(),
      updatedAt: t0.toISOString(),
      gameVersion: '1.93.1.62',
      target: { itemId: IDS.ORBE, qty: 1 },
      owned: {},
      mode: {},
      recipeChoice: { [IDS.ORBE]: 7362 },
      ui: { view: 'tree', missingOnly: false, collapsed: [] },
      snapshot: {},
    });
    expect(newList(1, 'v').id).not.toBe(newList(1, 'v').id);
  });
});

describe('historique', () => {
  const list = (id: string) => newList(1, 'v', {}, t0, id);

  it('la liste quittée passe en tête, sans doublon', () => {
    const history = pushHistory([list('a'), list('b')], list('c'));
    expect(history.map((l) => l.id)).toEqual(['c', 'a', 'b']);
    expect(pushHistory(history, list('b')).map((l) => l.id)).toEqual(['b', 'c', 'a']);
  });

  it(`garde les ${MAX_HISTORY} dernières`, () => {
    let history: CraftList[] = [];
    for (let i = 0; i < MAX_HISTORY + 3; i++) history = pushHistory(history, list(`l${i}`));
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0]!.id).toBe(`l${MAX_HISTORY + 2}`);
    expect(history.at(-1)!.id).toBe('l3');
  });
});

describe('quantités', () => {
  it('bornent la quantité cible entre 1 et le maximum, en entier', () => {
    const list = coiffe();
    expect(setTargetQty(list, 3.7, t1).target.qty).toBe(3);
    expect(setTargetQty(list, 0).target.qty).toBe(1);
    expect(setTargetQty(list, Number.NaN).target.qty).toBe(1);
    expect(setTargetQty(list, 1e9).target.qty).toBe(MAX_QTY);
    expect(setTargetQty(list, 2, t1).updatedAt).toBe(t1.toISOString());
  });

  it('une quantité possédée nulle ou négative est retirée', () => {
    let list = setOwned(coiffe(), IDS.POUDRE, 12);
    expect(list.owned).toEqual({ [IDS.POUDRE]: 12 });
    list = setOwned(list, IDS.POUDRE, 0);
    expect(list.owned).toEqual({});
    expect(setOwned(coiffe(), IDS.POUDRE, -3).owned).toEqual({});
  });

  it('ajouter ou retirer une quantité possédée reste entre 0 et le maximum', () => {
    let list = addOwned(coiffe(), IDS.POUDRE, 5, t1);
    expect(list.owned).toEqual({ [IDS.POUDRE]: 5 });
    expect(list.updatedAt).toBe(t1.toISOString());
    list = addOwned(list, IDS.POUDRE, 3);
    expect(list.owned).toEqual({ [IDS.POUDRE]: 8 });
    expect(addOwned(list, IDS.POUDRE, -20).owned).toEqual({});
    expect(addOwned(list, IDS.POUDRE, 1e9).owned).toEqual({ [IDS.POUDRE]: MAX_QTY });
  });
});

describe('treeItemIds', () => {
  it("objets de l'arbre complet d'après le snapshot, stock et achats compris", () => {
    const list = setMode(setOwned(withSnapshot(coiffe(), index), IDS.COIFFE_M, 1), IDS.FIL, 'buy');
    const ids = treeItemIds(list);
    for (const id of [IDS.COIFFE_L, IDS.COIFFE_M, IDS.ORBE, IDS.FIBRE, IDS.FIL, IDS.POUDRE]) expect(ids.has(id)).toBe(true);
    expect(ids.has(IDS.BAGUETTE)).toBe(false);
    // Sans snapshot : la cible seule.
    expect([...treeItemIds(coiffe())]).toEqual([IDS.COIFFE_L]);
  });
});

describe('case « je l\'ai »', () => {
  it('cocher fixe la quantité possédée à la demande, décocher la remet à 0', () => {
    let list = coiffe();
    expect(hasAll(list, IDS.POUDRE, 21)).toBe(false);
    list = toggleHave(list, IDS.POUDRE, 21);
    expect(list.owned[IDS.POUDRE]).toBe(21);
    expect(hasAll(list, IDS.POUDRE, 21)).toBe(true);
    list = toggleHave(list, IDS.POUDRE, 21);
    expect(list.owned[IDS.POUDRE]).toBeUndefined();
  });

  it('une quantité partielle laisse la case décochée ; la cocher complète', () => {
    let list = setOwned(coiffe(), IDS.POUDRE, 5);
    expect(hasAll(list, IDS.POUDRE, 21)).toBe(false);
    list = toggleHave(list, IDS.POUDRE, 21);
    expect(list.owned[IDS.POUDRE]).toBe(21);
    expect(hasAll(list, IDS.POUDRE, 0)).toBe(false);
  });

  it('cocher Coiffe M dans l\'arbre donne T1b', () => {
    const list = toggleHave(coiffe(), IDS.COIFFE_M, demandOf(coiffe(), IDS.COIFFE_M));
    const t1b = needsCases(index).find((c) => c.name.startsWith('T1b'))!;
    const { actual, expected } = observe(index, { ...t1b, input: needsInput(list) });
    expect(actual).toEqual(expected);
  });

  it('cocher Krak-Ertz dans la liste de courses le coche dans toutes les occurrences de l\'arbre', () => {
    const krak = [...index.items.values()].find((i) => i.name === 'Krak-Ertz')!.id;
    let list = coiffe();
    const line = shoppingList(index, computeNeeds(index, needsInput(list)), needsInput(list)).resources.find(
      (l) => l.itemId === krak,
    )!;
    expect(line.required).toBe(35);
    list = toggleHave(list, krak, line.required);
    const occurrences = nodes(list, krak);
    expect(occurrences).toHaveLength(2);
    expect(occurrences.every((n) => n.kind === 'stock')).toBe(true);
    expect(hasAll(list, krak, demandOf(list, krak))).toBe(true);
  });
});

describe('crafter / acheter et variantes', () => {
  it("« j'achète » puis « je le crafte »", () => {
    let list = setMode(coiffe(), IDS.FIL, 'buy');
    expect(list.mode).toEqual({ [IDS.FIL]: 'buy' });
    expect(nodes(list, IDS.FIL)[0]!.kind).toBe('buy');
    list = setMode(list, IDS.FIL, 'craft');
    expect(list.mode).toEqual({});
  });

  it('le choix de variante s\'applique à toutes les occurrences et est mémorisé', () => {
    const { list, prefs } = chooseRecipe(coiffe(), {}, IDS.ORBE, 7362, t1);
    expect(prefs).toEqual({ [IDS.ORBE]: 7362 });
    expect(nodes(list, IDS.ORBE).map((n) => n.recipe?.id)).toEqual([7362, 7362]);
    expect(list.updatedAt).toBe(t1.toISOString());
    // Une nouvelle liste reprend la variante mémorisée.
    expect(newList(IDS.COIFFE_L, index.version, prefs).recipeChoice).toEqual({ [IDS.ORBE]: 7362 });
  });
});

describe('état de l\'interface', () => {
  it('vue, filtre et nœuds repliés', () => {
    let list = setView(coiffe(), 'order');
    expect(list.ui.view).toBe('order');
    list = setMissingOnly(list, true);
    expect(list.ui.missingOnly).toBe(true);
    list = toggleCollapsed(list, `${IDS.COIFFE_L}/${IDS.COIFFE_M}`);
    expect(list.ui.collapsed).toEqual([`${IDS.COIFFE_L}/${IDS.COIFFE_M}`]);
    list = toggleCollapsed(list, `${IDS.COIFFE_L}/${IDS.COIFFE_M}`);
    expect(list.ui.collapsed).toEqual([]);
  });

  it('ne modifie pas les entrées du calcul (le calcul n\'est pas refait)', () => {
    const list = coiffe();
    const next = toggleCollapsed(setView(list, 'shopping'), 'x');
    expect(next.owned).toBe(list.owned);
    expect(next.mode).toBe(list.mode);
    expect(next.recipeChoice).toBe(list.recipeChoice);
    expect(next.target).toBe(list.target);
  });
});
