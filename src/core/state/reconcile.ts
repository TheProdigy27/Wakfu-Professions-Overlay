// Rapprochement d'une liste sauvegardée avec les données du jeu chargées.
import { describeChange, diffSnapshot, type RecipeSnapshot } from '../data/diffIndex';
import type { GameIndex } from '../data/loadIndex';
import { computeNeeds, recipesUsed } from '../needs/computeNeeds';
import type { CraftList } from './craftList';

/**
 * Recettes que la liste peut utiliser : l'arbre complet, sans le stock ni les achats, qui ne font que le tailler.
 * Il ne dépend que de l'objet cible et des variantes choisies (pas de la quantité).
 */
export function snapshotFor(index: GameIndex, list: CraftList): RecipeSnapshot {
  return recipesUsed(computeNeeds(index, { targets: [{ itemId: list.target.itemId, qty: 1 }], recipeChoice: list.recipeChoice }));
}

/** La liste avec son snapshot à jour ; la même liste si rien n'a changé. */
export function withSnapshot(list: CraftList, index: GameIndex): CraftList {
  const snapshot = snapshotFor(index, list);
  return JSON.stringify(snapshot) === JSON.stringify(list.snapshot) ? list : { ...list, snapshot };
}

/** Objet cible absent des données : la liste est obsolète (lecture seule), il faut rechercher un remplaçant. */
export function isObsolete(list: CraftList, index: GameIndex): boolean {
  return !index.items.has(list.target.itemId);
}

export interface Reconciled {
  list: CraftList;
  /** Notices du bandeau, par exemple « Orbe Durable : Krak-Ertz 7 → 8 ». */
  notices: string[];
  obsolete: boolean;
}

/**
 * À l'ouverture d'une liste. Si ses données datent d'une autre version du jeu : variantes disparues ramenées à la recette
 * par défaut, recettes modifiées signalées, quantités possédées conservées, snapshot et version mis à jour.
 */
export function reconcile(list: CraftList, index: GameIndex): Reconciled {
  if (isObsolete(list, index)) return { list, notices: [], obsolete: true };
  if (list.gameVersion === index.version) return { list: withSnapshot(list, index), notices: [], obsolete: false };

  const notices = diffSnapshot(list.snapshot, index).map((change) => describeChange(change, index));
  // Une variante disparue est retirée : la recette par défaut prend le relais.
  const recipeChoice = Object.fromEntries(
    Object.entries(list.recipeChoice).filter(([itemId, recipeId]) => index.recipes.get(recipeId)?.out === Number(itemId)),
  );
  const next: CraftList = { ...list, gameVersion: index.version, recipeChoice };
  return { list: { ...next, snapshot: snapshotFor(index, next) }, notices, obsolete: false };
}
