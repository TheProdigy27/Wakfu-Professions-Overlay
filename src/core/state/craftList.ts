// Liste de craft en cours et ses modifications, sous forme de fonctions pures.
// Schéma zod et migrations de l'état sauvegardé : schema.ts et migrations.ts ; nouvelles données du jeu : reconcile.ts.
import type { RecipeSnapshot } from '../data/diffIndex';
import type { NeedsInput } from '../needs/computeNeeds';

export type ListView = 'tree' | 'shopping' | 'order';

export interface CraftList {
  id: string;
  createdAt: string;
  updatedAt: string;
  gameVersion: string;
  target: { itemId: number; qty: number };
  /** Quantités possédées, propres à la liste (indexées par itemId). */
  owned: Record<number, number>;
  /** Absent = « je le crafte ». */
  mode: Record<number, 'buy'>;
  recipeChoice: Record<number, number>;
  ui: { view: ListView; missingOnly: boolean; collapsed: string[] };
  /** Recettes que la liste utilise, pour signaler leurs modifications à la prochaine version du jeu (reconcile.ts). */
  snapshot: RecipeSnapshot;
}

/** itemId → recipeId : variante mémorisée, valeur par défaut des nouvelles listes. */
export type RecipePrefs = Record<number, number>;

export const MAX_QTY = 9999;
export const MAX_HISTORY = 10;

function clampQty(qty: number, min: number): number {
  if (!Number.isFinite(qty)) return min;
  return Math.min(MAX_QTY, Math.max(min, Math.floor(qty)));
}

function touch(list: CraftList, patch: Partial<CraftList>, now: Date): CraftList {
  return { ...list, ...patch, updatedAt: now.toISOString() };
}

export function newList(
  itemId: number,
  gameVersion: string,
  prefs: RecipePrefs = {},
  now = new Date(),
  id: string = crypto.randomUUID(),
): CraftList {
  return {
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    gameVersion,
    target: { itemId, qty: 1 },
    owned: {},
    mode: {},
    recipeChoice: { ...prefs },
    ui: { view: 'tree', missingOnly: false, collapsed: [] },
    snapshot: {},
  };
}

/** La liste quittée passe en tête de l'historique : 10 dernières, sans doublon. */
export function pushHistory(history: readonly CraftList[], list: CraftList): CraftList[] {
  return [list, ...history.filter((l) => l.id !== list.id)].slice(0, MAX_HISTORY);
}

export function needsInput(list: CraftList): NeedsInput {
  return { targets: [list.target], owned: list.owned, mode: list.mode, recipeChoice: list.recipeChoice };
}

export function setTargetQty(list: CraftList, qty: number, now = new Date()): CraftList {
  return touch(list, { target: { ...list.target, qty: clampQty(qty, 1) } }, now);
}

export function setOwned(list: CraftList, itemId: number, qty: number, now = new Date()): CraftList {
  const owned = { ...list.owned };
  const value = clampQty(qty, 0);
  if (value > 0) owned[itemId] = value;
  else delete owned[itemId];
  return touch(list, { owned }, now);
}

/** Ajoute (delta > 0) ou retire (delta < 0) une quantité possédée, sans descendre sous 0. */
export function addOwned(list: CraftList, itemId: number, delta: number, now = new Date()): CraftList {
  return setOwned(list, itemId, (list.owned[itemId] ?? 0) + delta, now);
}

/** Objets de l'arbre complet (cible, intermédiaires, ingrédients), quels que soient le stock et les achats : d'après le snapshot. */
export function treeItemIds(list: CraftList): Set<number> {
  const ids = new Set([list.target.itemId]);
  for (const [itemId, recipe] of Object.entries(list.snapshot)) {
    ids.add(Number(itemId));
    for (let i = 0; i < recipe.ings.length; i += 2) ids.add(recipe.ings[i]!);
  }
  return ids;
}

/** Case « je l'ai » : cochée si la quantité possédée couvre toute la demande. */
export function hasAll(list: CraftList, itemId: number, demand: number): boolean {
  return demand > 0 && (list.owned[itemId] ?? 0) >= demand;
}

/** Cocher fixe la quantité possédée à la demande totale ; décocher la remet à 0. */
export function toggleHave(list: CraftList, itemId: number, demand: number, now = new Date()): CraftList {
  return setOwned(list, itemId, hasAll(list, itemId, demand) ? 0 : demand, now);
}

export function setMode(list: CraftList, itemId: number, mode: 'craft' | 'buy', now = new Date()): CraftList {
  const next = { ...list.mode };
  if (mode === 'buy') next[itemId] = 'buy';
  else delete next[itemId];
  return touch(list, { mode: next }, now);
}

/** Choix d'une variante : appliqué à la liste et mémorisé pour les prochaines listes. */
export function chooseRecipe(
  list: CraftList,
  prefs: RecipePrefs,
  itemId: number,
  recipeId: number,
  now = new Date(),
): { list: CraftList; prefs: RecipePrefs } {
  return {
    list: touch(list, { recipeChoice: { ...list.recipeChoice, [itemId]: recipeId } }, now),
    prefs: { ...prefs, [itemId]: recipeId },
  };
}

export function setView(list: CraftList, view: ListView): CraftList {
  return { ...list, ui: { ...list.ui, view } };
}

export function setMissingOnly(list: CraftList, missingOnly: boolean): CraftList {
  return { ...list, ui: { ...list.ui, missingOnly } };
}

/** Replie ou déplie un nœud de l'arbre, identifié par sa clé (chemin des itemId). */
export function toggleCollapsed(list: CraftList, key: string): CraftList {
  const collapsed = list.ui.collapsed.includes(key)
    ? list.ui.collapsed.filter((k) => k !== key)
    : [...list.ui.collapsed, key];
  return { ...list, ui: { ...list.ui, collapsed } };
}
