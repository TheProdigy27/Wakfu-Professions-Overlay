// Écarts entre les recettes mémorisées par une liste et un nouvel index.
import type { GameIndex } from './loadIndex';

/** itemId → recette utilisée au dernier calcul (ingrédients à plat : itemId, qty, itemId, qty…). */
export type RecipeSnapshot = Record<number, { recipeId: number; yield: number; ings: number[] }>;

export interface IngredientChange {
  itemId: number;
  /** 0 = ingrédient ajouté. */
  before: number;
  /** 0 = ingrédient retiré. */
  after: number;
}

export type SnapshotChange =
  | { kind: 'item-removed'; itemId: number }
  | { kind: 'recipe-removed'; itemId: number; recipeId: number }
  | {
      kind: 'recipe-changed';
      itemId: number;
      recipeId: number;
      yield?: { before: number; after: number };
      ings: IngredientChange[];
    };

function quantities(flat: readonly number[]): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i + 1 < flat.length; i += 2) out.set(flat[i]!, (out.get(flat[i]!) ?? 0) + flat[i + 1]!);
  return out;
}

export function diffSnapshot(snapshot: RecipeSnapshot, index: GameIndex): SnapshotChange[] {
  const changes: SnapshotChange[] = [];
  const ids = Object.keys(snapshot)
    .map(Number)
    .sort((a, b) => a - b);
  for (const itemId of ids) {
    const saved = snapshot[itemId]!;
    if (!index.items.has(itemId)) {
      changes.push({ kind: 'item-removed', itemId });
      continue;
    }
    const recipe = index.recipes.get(saved.recipeId);
    if (!recipe || recipe.out !== itemId) {
      changes.push({ kind: 'recipe-removed', itemId, recipeId: saved.recipeId });
      continue;
    }
    const before = quantities(saved.ings);
    const after = quantities(recipe.ings.flatMap((g) => [g.itemId, g.qty]));
    const ings: IngredientChange[] = [];
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const b = before.get(id) ?? 0;
      const a = after.get(id) ?? 0;
      if (a !== b) ings.push({ itemId: id, before: b, after: a });
    }
    const yieldChanged = recipe.yield !== saved.yield;
    if (ings.length || yieldChanged) {
      changes.push({
        kind: 'recipe-changed',
        itemId,
        recipeId: saved.recipeId,
        ...(yieldChanged ? { yield: { before: saved.yield, after: recipe.yield } } : {}),
        ings,
      });
    }
  }
  return changes;
}

/** Texte de la notice, par exemple « Orbe Durable : Krak-Ertz 7 → 8 ». */
export function describeChange(change: SnapshotChange, index: GameIndex): string {
  const name = (id: number) => index.items.get(id)?.name ?? `Objet #${id}`;
  switch (change.kind) {
    case 'item-removed':
      return `${name(change.itemId)} : objet retiré du jeu`;
    case 'recipe-removed':
      return `${name(change.itemId)} : la recette choisie n'existe plus, recette par défaut utilisée`;
    case 'recipe-changed': {
      const parts: string[] = [];
      if (change.yield) parts.push(`rendement ${change.yield.before} → ${change.yield.after}`);
      for (const g of change.ings) {
        if (g.before === 0) parts.push(`${name(g.itemId)} ajouté (×${g.after})`);
        else if (g.after === 0) parts.push(`${name(g.itemId)} retiré (×${g.before})`);
        else parts.push(`${name(g.itemId)} ${g.before} → ${g.after}`);
      }
      return `${name(change.itemId)} : ${parts.join(', ')}`;
    }
  }
}
