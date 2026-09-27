// Liste de courses : ce qui s'obtient autrement qu'en craftant.
import { isCraftable, type GameIndex } from '../data/loadIndex';
import type { NeedsInput, NeedsResult } from './computeNeeds';

export interface ShoppingLine {
  itemId: number;
  required: number;
  owned: number;
  missing: number;
}

export interface ShoppingList {
  /** Objets non craftables, ou pris dans un cycle. */
  resources: ShoppingLine[];
  /** Intermédiaires en « j'achète ». */
  bought: ShoppingLine[];
}

export function shoppingList(
  index: GameIndex,
  result: NeedsResult,
  input: NeedsInput,
  options: { missingOnly?: boolean } = {},
): ShoppingList {
  const resources: ShoppingLine[] = [];
  const bought: ShoppingLine[] = [];
  for (const [itemId, t] of result.totals) {
    const craftable = isCraftable(index, itemId);
    const isBought = craftable && input.mode?.[itemId] === 'buy';
    // Un intermédiaire crafté n'est pas une ligne de courses, sauf s'il reste à obtenir (cycle).
    if (craftable && !isBought && t.toObtain === 0) continue;
    if (options.missingOnly && t.toObtain === 0) continue;
    const line = { itemId, required: t.demand, owned: input.owned?.[itemId] ?? 0, missing: t.toObtain };
    (isBought ? bought : resources).push(line);
  }
  const name = (id: number) => index.items.get(id)?.name ?? `#${id}`;
  const byName = (a: ShoppingLine, b: ShoppingLine) => name(a.itemId).localeCompare(name(b.itemId), 'fr') || a.itemId - b.itemId;
  return { resources: resources.sort(byName), bought: bought.sort(byName) };
}

/**
 * Liste de courses en texte, pour le presse-papiers : seulement ce qui reste à obtenir.
 * `title` décrit l'objet cible, par exemple « Coiffe Lardante (Légendaire) ×1 ».
 */
export function shoppingText(index: GameIndex, title: string, list: ShoppingList): string {
  const name = (id: number) => index.items.get(id)?.name ?? `Objet inconnu #${id}`;
  const section = (heading: string, lines: ShoppingLine[]) => {
    const missing = lines.filter((l) => l.missing > 0);
    return missing.length ? [heading, ...missing.map((l) => `- ${name(l.itemId)} ×${l.missing}`)] : [];
  };
  const sections = [section('Ressources', list.resources), section('Intermédiaires achetés', list.bought)].filter((s) => s.length);
  const body = sections.length ? sections.flatMap((s, i) => (i ? ['', ...s] : s)) : ['Rien ne manque.'];
  return [`${title} : liste de courses`, '', ...body].join('\n');
}
