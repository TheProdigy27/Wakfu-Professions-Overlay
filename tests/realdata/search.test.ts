import { beforeAll, describe, expect, it } from 'vitest';
import type { GameIndex } from '../../src/core/data/loadIndex';
import { createSearchIndex, type SearchIndex } from '../../src/core/match/searchIndex';
import { NameVocabulary } from '../../src/core/match/vocabulary';
import { IDS } from '../helpers/needsCases';
import { buildRealIndex, REAL_DATA_VERSION } from '../helpers/realData';

let index: GameIndex;
let vocab: NameVocabulary;
let search: SearchIndex;
beforeAll(async () => {
  index = (await buildRealIndex()).index;
  vocab = new NameVocabulary(index);
  search = createSearchIndex(vocab);
});

describe(`données réelles ${REAL_DATA_VERSION} : recherche`, () => {
  it('vocabulaire : noms craftables distincts, un seul couple fusionné par la normalisation', () => {
    const distinct = new Set([...index.recipesByItem.keys()].map((id) => index.items.get(id)!.name));
    expect(distinct.size).toBe(3751);
    expect(vocab.norms.length).toBe(3750);
  });

  it.each(['coiffe lardante', 'Coiffe Lardanle', 'COIFFE LARDANTE', 'coiffe lard'])('« %s » → les deux raretés de Coiffe Lardante en tête', (q) => {
    expect(search.search(q).slice(0, 2).map((i) => i.id)).toEqual([IDS.COIFFE_M, IDS.COIFFE_L]);
  });

  it('noms faits de ponctuation tapés tels quels', () => {
    expect(search.search('!"(-è@)"').map((i) => i.id)).toContain(IDS.PONCTUATION_1);
    expect(search.search('".#@)é').map((i) => i.id)).toContain(IDS.PONCTUATION_2);
  });

  it('chaque objet craftable est trouvé par son nom exact, toutes raretés, parmi les 10 résultats', () => {
    const missed: string[] = [];
    let max = 0;
    // Une recherche par nom distinct : toutes les raretés de ce nom doivent figurer dans les résultats.
    for (const group of vocab.groups.values()) {
      const t0 = performance.now();
      const found = new Set(search.search(group[0]!.name).map((r) => r.id));
      max = Math.max(max, performance.now() - t0);
      for (const item of group) if (!found.has(item.id)) missed.push(`${item.name} #${item.id}`);
    }
    console.log(`${vocab.groups.size} noms cherchés tels quels ; recherche la plus lente : ${max.toFixed(1)} ms`);
    expect(missed).toEqual([]);
  });

  it('temps de réponse sur des saisies variées < 50 ms', () => {
    const queries = ['c', 'co', 'coi', 'orbe dur', 'epee', 'anneau de', 'bottes de n', 'pain', 'fil', 'plastron du passeur'];
    let max = 0;
    for (const q of queries) {
      const t0 = performance.now();
      search.search(q);
      max = Math.max(max, performance.now() - t0);
    }
    console.log(`recherche : max ${max.toFixed(1)} ms sur ${queries.length} saisies`);
    expect(max).toBeLessThan(50);
  });
});
