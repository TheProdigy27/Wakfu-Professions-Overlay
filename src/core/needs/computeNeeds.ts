// Calcul des besoins : parcours en profondeur avec stock partagé (possédé + surplus des crafts).
import type { RecipeSnapshot } from '../data/diffIndex';
import { defaultRecipe, type GameIndex, type Recipe } from '../data/loadIndex';

export interface Target {
  itemId: number;
  qty: number;
}

export interface NeedsInput {
  targets: readonly Target[];
  /** itemId → quantité possédée. */
  owned?: Readonly<Record<number, number>>;
  /** itemId → 'buy' ; absent = « je le crafte ». */
  mode?: Readonly<Record<number, 'buy'>>;
  /** itemId → recipeId choisi ; absent ou invalide = recette par défaut. */
  recipeChoice?: Readonly<Record<number, number>>;
}

/**
 * craft : fabriqué ; stock : entièrement couvert par le stock ; base : non craftable, à obtenir ;
 * buy : craftable mais « j'achète » ; cycle : craftable mais déjà présent parmi ses ancêtres.
 */
export type NodeKind = 'craft' | 'stock' | 'base' | 'buy' | 'cycle';

export interface NeedNode {
  /** Chemin des itemId depuis la racine, joints par « / » : stable d'un calcul à l'autre. */
  key: string;
  itemId: number;
  qty: number;
  fromStock: number;
  crafts: number;
  recipe?: Recipe;
  toObtain: number;
  kind: NodeKind;
  children: NeedNode[];
}

export interface ItemTotal {
  demand: number;
  fromStock: number;
  crafts: number;
  toObtain: number;
}

export interface NeedsResult {
  roots: NeedNode[];
  totals: Map<number, ItemTotal>;
  /** Stock restant après calcul : possédé non consommé + surplus des crafts. */
  leftover: Map<number, number>;
  /** Ids absents de l'index (« Objet inconnu #id »), traités comme ressources à obtenir. */
  unknownItemIds: number[];
}

/** Recette effectivement utilisée pour un objet : le choix de la liste s'il est encore valide, sinon la recette par défaut. */
export function resolveRecipe(index: GameIndex, input: NeedsInput, itemId: number): Recipe | undefined {
  const chosen = input.recipeChoice?.[itemId];
  if (chosen !== undefined) {
    const recipe = index.recipes.get(chosen);
    if (recipe?.out === itemId) return recipe;
  }
  return defaultRecipe(index, itemId);
}

export function computeNeeds(index: GameIndex, input: NeedsInput): NeedsResult {
  const pool = new Map<number, number>();
  for (const [id, qty] of Object.entries(input.owned ?? {})) if (qty > 0) pool.set(Number(id), qty);
  const totals = new Map<number, ItemTotal>();
  const unknown = new Set<number>();

  const need = (itemId: number, qty: number, path: readonly number[]): NeedNode => {
    let t = totals.get(itemId);
    if (!t) totals.set(itemId, (t = { demand: 0, fromStock: 0, crafts: 0, toObtain: 0 }));
    t.demand += qty;
    const available = pool.get(itemId) ?? 0;
    const taken = Math.min(available, qty);
    if (taken > 0) pool.set(itemId, available - taken);
    t.fromStock += taken;
    const rest = qty - taken;
    const node: NeedNode = {
      key: [...path, itemId].join('/'),
      itemId,
      qty,
      fromStock: taken,
      crafts: 0,
      toObtain: 0,
      kind: 'stock',
      children: [],
    };
    if (!index.items.has(itemId)) unknown.add(itemId);
    if (rest === 0) return node;

    const recipe = resolveRecipe(index, input, itemId);
    const inCycle = path.includes(itemId);
    if (recipe && input.mode?.[itemId] !== 'buy' && !inCycle) {
      const n = Math.ceil(rest / recipe.yield);
      const surplus = n * recipe.yield - rest;
      if (surplus > 0) pool.set(itemId, (pool.get(itemId) ?? 0) + surplus);
      t.crafts += n;
      node.crafts = n;
      node.recipe = recipe;
      node.kind = 'craft';
      const childPath = [...path, itemId];
      node.children = recipe.ings.map((g) => need(g.itemId, n * g.qty, childPath));
    } else {
      t.toObtain += rest;
      node.toObtain = rest;
      node.kind = inCycle ? 'cycle' : recipe ? 'buy' : 'base';
    }
    return node;
  };

  const roots = input.targets.map((target) => need(target.itemId, target.qty, []));
  const leftover = new Map([...pool].filter(([, q]) => q > 0));
  return { roots, totals, leftover, unknownItemIds: [...unknown].sort((a, b) => a - b) };
}

/** Recettes utilisées par le calcul, pour détecter plus tard une modification des données. */
export function recipesUsed(result: NeedsResult): RecipeSnapshot {
  const out: RecipeSnapshot = {};
  const walk = (node: NeedNode): void => {
    if (node.recipe && out[node.itemId] === undefined) {
      const r = node.recipe;
      out[node.itemId] = { recipeId: r.id, yield: r.yield, ings: r.ings.flatMap((g) => [g.itemId, g.qty]) };
    }
    node.children.forEach(walk);
  };
  result.roots.forEach(walk);
  return out;
}
