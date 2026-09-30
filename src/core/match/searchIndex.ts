// Recherche : Fuse.js sur les noms craftables, tolérante aux fautes de frappe.
import Fuse from 'fuse.js';
import type { Item } from '../data/loadIndex';
import { normalize } from './normalize';
import type { NameVocabulary } from './vocabulary';

export const SEARCH_LIMIT = 10;

export interface SearchIndex {
  /** Objets (une entrée par rareté), du plus pertinent au moins pertinent. */
  search(query: string, limit?: number): Item[];
}

export function createSearchIndex(vocab: NameVocabulary): SearchIndex {
  const fuse = new Fuse(vocab.norms, { ignoreLocation: true, threshold: 0.4, includeScore: true });
  return {
    search(query, limit = SEARCH_LIMIT) {
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
