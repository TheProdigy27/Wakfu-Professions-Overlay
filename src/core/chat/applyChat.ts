// Quantités possédées mises à jour d'après le chat de Wakfu : objets ramassés ou perdus en jeu.
import type { Names } from '../data/indexFile';
import { LOCALES } from '../i18n/locale';
import { addOwned, treeItemIds, type CraftList } from '../state/craftList';
import type { ChatItemChange } from './chatLine';

/**
 * Le chat ne donne que le nom de l'objet : il est cherché parmi les objets de l'arbre de la liste, dans la langue du
 * client de jeu. Un nom absent de l'arbre est ignoré, comme un nom porté par plusieurs de ses objets (même équipement
 * en plusieurs raretés dans une chaîne d'amélioration). Renvoie la même liste si rien ne change.
 */
export function applyChatChanges(
  list: CraftList,
  changes: readonly ChatItemChange[],
  names: (itemId: number) => Names | undefined,
  now = new Date(),
): CraftList {
  const ids = [...treeItemIds(list)];
  let next = list;
  for (const change of changes) {
    const lang = LOCALES.indexOf(change.locale);
    const matches = ids.filter((id) => names(id)?.[lang]?.trim() === change.name);
    if (matches.length !== 1) continue;
    const updated = addOwned(next, matches[0]!, change.qty, now);
    if (updated.owned[matches[0]!] !== next.owned[matches[0]!]) next = updated;
  }
  return next;
}
