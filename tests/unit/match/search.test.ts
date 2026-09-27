import { describe, expect, it } from 'vitest';
import { createSearchIndex } from '../../../src/core/match/searchIndex';
import { NameVocabulary } from '../../../src/core/match/vocabulary';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';

const { index } = loadFixture();
const vocab = new NameVocabulary(index);
const search = createSearchIndex(index, vocab);
const ids = (query: string, limit?: number) => search.search(query, limit).map((i) => i.id);

describe('NameVocabulary', () => {
  it('regroupe les homonymes par nom normalisé, par rareté croissante', () => {
    expect(vocab.groups.get('coiffe lardante')!.map((i) => [i.id, i.rarity])).toEqual([
      [IDS.COIFFE_M, 3],
      [IDS.COIFFE_L, 4],
    ]);
    // « lieues » et « Lieues » ne diffèrent que par la casse.
    expect(vocab.groups.get("bottes de n'oeuf lieues")!.map((i) => i.rarity)).toEqual([2, 3, 4]);
  });

  it('ne contient que des objets craftables', () => {
    expect(vocab.groups.has('poudre')).toBe(false);
    expect([...vocab.groups.values()].flat().every((i) => index.recipesByItem.has(i.id))).toBe(true);
  });
});

describe('createSearchIndex', () => {
  it('« coiffe lard » propose les deux raretés en tête', () => {
    expect(ids('coiffe lard').slice(0, 2)).toEqual([IDS.COIFFE_M, IDS.COIFFE_L]);
  });

  it.each(['coiffe lardante', 'Coiffe Lardanle', 'COIFFE LARDANTE'])('« %s » : casse et faute de frappe tolérées', (query) => {
    expect(ids(query).slice(0, 2)).toEqual([IDS.COIFFE_M, IDS.COIFFE_L]);
  });

  it('ignore accents et casse', () => {
    expect(search.search('ÉPAULETTES lardantes')[0]!.name).toBe('Epaulettes Lardantes');
  });

  it('trouve les noms faits de ponctuation tapés tels quels', () => {
    // Dans la fixture, seule la rareté Légendaire de ces deux noms est craftable.
    expect(ids('!"(-è@)"')[0]).toBe(IDS.PONCTUATION_1);
    expect(ids('".#@)é')[0]).toBe(IDS.PONCTUATION_2);
    expect(ids('Wé')[0]).toBe(27193);
  });

  it('accepte un identifiant #id', () => {
    expect(ids('#29236')).toEqual([IDS.PONCTUATION_1]);
    expect(ids(' # 27093 ')).toEqual([IDS.POUDRE]);
    expect(ids('#999999')).toEqual([]);
  });

  it('limite le nombre de résultats', () => {
    expect(search.search('')).toEqual([]);
    expect(search.search('e', 3)).toHaveLength(3);
    expect(search.search('bottes', 1)).toHaveLength(1);
  });
});
