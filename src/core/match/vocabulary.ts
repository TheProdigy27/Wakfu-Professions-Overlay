// Vocabulaire de la recherche : noms normalisés des objets craftables, homonymes regroupés.
import type { GameIndex, Item } from '../data/loadIndex';
import { normalize } from './normalize';

export class NameVocabulary {
  /** Nom normalisé → objets (par rareté croissante). */
  readonly groups = new Map<string, Item[]>();
  /** Noms normalisés, triés. */
  readonly norms: readonly string[];

  constructor(index: GameIndex) {
    for (const itemId of index.recipesByItem.keys()) {
      const item = index.items.get(itemId);
      if (!item) continue;
      const norm = normalize(item.name);
      const group = this.groups.get(norm);
      if (group) group.push(item);
      else this.groups.set(norm, [item]);
    }
    for (const group of this.groups.values()) group.sort((a, b) => a.rarity - b.rarity || a.id - b.id);
    this.norms = [...this.groups.keys()].sort();
  }
}
