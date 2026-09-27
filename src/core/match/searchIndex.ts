// Recherche : Fuse.js sur les noms craftables, ou identifiant « #29236 ».
import Fuse from 'fuse.js';
import type { GameIndex, Item } from '../data/loadIndex';
import { normalize } from './normalize';
import type { NameVocabulary } from './vocabulary';

export const SEARCH_LIMIT = 10;

export interface SearchIndex {
  /** Objets (une entrée par rareté), du plus pertinent au moins pertinent. */
  search(query: string, limit?: number): Item[];
}

export function createSearchIndex(index: GameIndex, vocab: NameVocabulary): SearchIndex {
  const fuse = new Fuse(vocab.norms, { ignoreLocation: true, threshold: 0.4, includeScore: true });
  return {
    search(query, limit = SEARCH_LIMIT) {
      const id = /^#\s*(\d+)$/.exec(query.trim());
      if (id) {
        const item = index.items.get(Number(id[1]));
        return item ? [item] : [];
      }
      const q = normalize(query);
      if (!q) return [];
      const out: Item[] = [];
      for (const r of fuse.search(q)) {
        for (const item of vocab.groups.get(r.item)!) {
          out.push(item);
          if (out.length === limit) return out;
        }
      }
      return out;
    },
  };
}
