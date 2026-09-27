// Oracle MRP : demande brute agrégée par objet, objets traités par niveau le plus bas
// (plus long chemin depuis les racines), stock déduit une seule fois par objet. Sert uniquement à vérifier computeNeeds.
import fc from 'fast-check';
import type { GameIndex } from '../../src/core/data/loadIndex';
import { computeNeeds, resolveRecipe, type NeedsInput } from '../../src/core/needs/computeNeeds';

export function mrpOracle(index: GameIndex, input: NeedsInput): { crafts: Map<number, number>; toObtain: Map<number, number> } {
  const expands = (id: number) => {
    const r = resolveRecipe(index, input, id);
    return r && input.mode?.[id] !== 'buy' ? r : undefined;
  };
  const llc = new Map<number, number>();
  const walk = (id: number, depth: number, stack: Set<number>): void => {
    if (stack.has(id) || (llc.get(id) ?? -1) >= depth) return;
    llc.set(id, depth);
    const r = expands(id);
    if (!r) return;
    stack.add(id);
    for (const g of r.ings) walk(g.itemId, depth + 1, stack);
    stack.delete(id);
  };
  for (const t of input.targets) walk(t.itemId, 0, new Set());

  const gross = new Map<number, number>();
  for (const t of input.targets) gross.set(t.itemId, (gross.get(t.itemId) ?? 0) + t.qty);
  const crafts = new Map<number, number>();
  const toObtain = new Map<number, number>();
  for (const id of [...llc.keys()].sort((a, b) => llc.get(a)! - llc.get(b)!)) {
    const net = Math.max(0, (gross.get(id) ?? 0) - (input.owned?.[id] ?? 0));
    if (net === 0) continue;
    const r = expands(id);
    if (r) {
      const n = Math.ceil(net / r.yield);
      crafts.set(id, n);
      for (const g of r.ings) gross.set(g.itemId, (gross.get(g.itemId) ?? 0) + n * g.qty);
    } else {
      toObtain.set(id, net);
    }
  }
  return { crafts, toObtain };
}

/** Tirage aléatoire : objet, quantité, stocks, « j'achète » et variantes, choisis parmi les objets de l'arbre de la cible. */
export const drawArbitrary = fc.record({
  target: fc.nat(),
  qty: fc.integer({ min: 1, max: 5 }),
  owned: fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 12 }),
  buy: fc.array(fc.nat(), { maxLength: 3 }),
  variants: fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 3 }),
});

export type Draw = typeof drawArbitrary extends fc.Arbitrary<infer T> ? T : never;

export function inputFromDraw(index: GameIndex, craftable: readonly number[], d: Draw): NeedsInput {
  const target = craftable[d.target % craftable.length]!;
  const base = computeNeeds(index, { targets: [{ itemId: target, qty: d.qty }] });
  const tree = [...base.totals.keys()];
  const owned: Record<number, number> = {};
  for (const [i, q] of d.owned) {
    const id = tree[i % tree.length]!;
    owned[id] = q % (base.totals.get(id)!.demand + 2);
  }
  const intermediates = tree.filter((id) => id !== target && index.recipesByItem.has(id));
  const mode: Record<number, 'buy'> = {};
  if (intermediates.length) for (const i of d.buy) mode[intermediates[i % intermediates.length]!] = 'buy';
  const multi = tree.filter((id) => (index.recipesByItem.get(id)?.length ?? 0) > 1);
  const recipeChoice: Record<number, number> = {};
  if (multi.length) {
    for (const [i, v] of d.variants) {
      const id = multi[i % multi.length]!;
      const recipes = index.recipesByItem.get(id)!;
      recipeChoice[id] = recipes[v % recipes.length]!.id;
    }
  }
  return { targets: [{ itemId: target, qty: d.qty }], owned, mode, recipeChoice };
}

/** Totaux de computeNeeds sous la forme de l'oracle. */
export function needsAsOracle(index: GameIndex, input: NeedsInput) {
  const res = computeNeeds(index, input);
  const pick = (k: 'crafts' | 'toObtain') =>
    new Map([...res.totals].filter(([, t]) => t[k] > 0).map(([id, t]) => [id, t[k]]));
  return { crafts: pick('crafts'), toObtain: pick('toObtain') };
}
