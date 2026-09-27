// Bouton « Retour » : écrans quittés (crafts par métier ouverts ou non, liste en cours), à retrouver dans l'ordre inverse.
import { pushHistory, type CraftList } from './craftList';

export interface Screen {
  /** Crafts par métier affichés à la place de la liste. */
  jobs: boolean;
  /** Liste en cours à ce moment-là ; null : aucune. */
  listId: string | null;
}

/** Retours possibles d'affilée : au-delà, les écrans les plus anciens sont oubliés. */
export const MAX_BACK = 30;

/** Écran quitté par une navigation ; rien de plus si c'est déjà le dernier retenu. */
export function pushScreen(stack: readonly Screen[], screen: Screen): Screen[] {
  const last = stack.at(-1);
  if (last?.jobs === screen.jobs && last.listId === screen.listId) return [...stack];
  return [...stack, screen].slice(-MAX_BACK);
}

/**
 * Listes après un retour vers la liste listId : elle redevient la liste en cours. Celle qu'on quitte passe dans
 * l'historique, sauf si elle n'a jamais été modifiée (objet ouvert par mégarde). Liste retirée de l'historique entre-temps :
 * rien ne change.
 */
export function listsAfterBack(
  current: CraftList | null,
  history: readonly CraftList[],
  listId: string | null,
): { current: CraftList | null; history: CraftList[] } {
  if ((current?.id ?? null) === listId) return { current, history: [...history] };
  const target = listId === null ? null : history.find((l) => l.id === listId);
  if (target === undefined) return { current, history: [...history] };
  const rest = history.filter((l) => l.id !== listId);
  const used = current !== null && current.updatedAt !== current.createdAt;
  return { current: target, history: used ? pushHistory(rest, current) : rest };
}
