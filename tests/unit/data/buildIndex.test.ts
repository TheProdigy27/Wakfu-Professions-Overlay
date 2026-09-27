import { describe, expect, it } from 'vitest';
import { buildIndex, DataBuildError, singularTitle, titleNames } from '../../../src/core/data/buildIndex';
import { INDEX_SCHEMA } from '../../../src/core/data/indexFile';
import {
  HARVEST_FILE_NAMES,
  parseHarvestFile,
  parseItemsFallback,
  parseRawFile,
  RAW_FILE_NAMES,
  type RawGamedata,
  type RawHarvest,
} from '../../../src/core/data/rawSchemas';
import { SMALL_COUNTS, syntheticRaw, type SyntheticOptions } from '../../helpers/synthetic';

function parsed(options?: SyntheticOptions): { raw: RawGamedata; harvest: RawHarvest; json: Record<string, unknown> } {
  const json = syntheticRaw(options);
  const raw = Object.fromEntries(RAW_FILE_NAMES.map((n) => [n, parseRawFile(n, json[n])])) as RawGamedata;
  const harvest = Object.fromEntries(HARVEST_FILE_NAMES.map((n) => [n, parseHarvestFile(n, json[n])])) as RawHarvest;
  return { raw, harvest, json };
}

const builtAt = new Date('2026-09-26T12:00:00Z');

describe('buildIndex', () => {
  it('construit un index compact trié et déterministe', () => {
    const { raw, harvest } = parsed();
    const { file, report } = buildIndex('1.0', raw, { minCounts: SMALL_COUNTS, builtAt, harvest });
    expect(file).toEqual({
      indexSchema: INDEX_SCHEMA,
      gameVersion: '1.0',
      builtAt: '2026-09-26T12:00:00.000Z',
      jobs: [
        [40, ['Boulanger', 'Baker', 'Panadero', 'Padeiro']],
        [64, ['Paysan', 'Farmer', 'Campesino', 'Fazendeiro']],
      ],
      // Gabarit de pluriel retiré dans chaque langue.
      types: [[1, ['Céréale', 'Cereal', 'Cereal', 'Cereal']]],
      items: [
        [1, ['Blé', 'Wheat', 'Trigo', 'Trigo'], 1, 1, 1, 100],
        // Espagnol vide, portugais absent : nom français.
        [2, ['Farine', 'Flour', 'Farine', 'Farine'], 5, 1, 1, 200],
        [3, ['Pain', 'Pain', 'Pain', 'Pain'], 10, 2, 1, 300],
        [4, ["Seau d'eau", "Seau d'eau", "Seau d'eau", "Seau d'eau"], 1, 1, 1, 400],
      ],
      recipes: [
        [10, 40, 5, 0, 2, 1, [1, 2]],
        // Ingrédients dans l'ordre ingredientOrder, pas dans l'ordre du fichier.
        [11, 40, 10, 0, 3, 4, [2, 1, 4, 1]],
        // Deux résultats : celui de productOrder 0.
        [14, 40, 3, 1, 1, 3, [4, 2]],
      ],
      // Eau : deux métiers, du niveau le plus bas au plus haut ; pour le Paysan, le plus bas de ses deux ressources.
      // Blé et Farine se craftent ; Levure (butin) n'est pas dans l'index sans items.json.
      harvest: [
        [4, 40, 3],
        [4, 64, 5],
      ],
    });
    expect(report).toEqual({
      recipes: 3,
      excludedRecipes: 2, // R12 (métier archivé), R13 (sans ingrédient)
      items: 4,
      missingItemIds: [],
      itemsFromFallback: 0,
      multiResultRecipes: 1,
      harvestedItems: 1,
    });
  });

  it('sans les fichiers de récolte : index sans provenance', () => {
    const { file, report } = buildIndex('1.0', parsed().raw, { minCounts: SMALL_COUNTS });
    expect(file.harvest).toEqual([]);
    expect(report.harvestedItems).toBe(0);
  });

  it('signale les ids absents de jobsItems.json, puis les résout avec items.json', () => {
    const { raw, harvest, json } = parsed({ withYeast: true });
    const without = buildIndex('1.0', raw, { minCounts: SMALL_COUNTS });
    expect(without.report.missingItemIds).toEqual([5]);
    expect(without.file.items.map((i) => i[0])).toEqual([1, 2, 3, 4]);

    const withFallback = buildIndex('1.0', raw, { minCounts: SMALL_COUNTS, itemsFallback: parseItemsFallback(json.items), harvest });
    expect(withFallback.report).toMatchObject({ missingItemIds: [], itemsFromFallback: 1 });
    expect(withFallback.file.items.at(-1)).toEqual([5, ['Levure', 'Levure', 'Levure', 'Levure'], 3, 1, 1, 500]);
    // Levure : seulement en butin de récolte.
    expect(withFallback.file.harvest.at(-1)).toEqual([5, 64, 20]);
  });

  it('refuse des données trop maigres (format probablement changé)', () => {
    expect(() => buildIndex('1.0', parsed().raw)).toThrow(DataBuildError);
    expect(() => buildIndex('1.0', parsed().raw, { minCounts: { recipes: 1, items: 1, jobs: 3 } })).toThrow(
      'jobs : 2 entrées, minimum attendu 3',
    );
  });
});

describe('singularTitle', () => {
  it('retire le gabarit de pluriel', () => {
    expect(singularTitle('Anneau{[~1]?x:}')).toBe('Anneau');
    expect(singularTitle('Hache{[~1]?s:} (Deux mains)')).toBe('Hache (Deux mains)');
    expect(singularTitle('Cheva{[~1]?ux:l}')).toBe('Cheval');
    expect(singularTitle('An{[~1]?éis:el}')).toBe('Anel');
    expect(singularTitle('Fish{[~1]?:}')).toBe('Fish');
    expect(singularTitle('Ressource')).toBe('Ressource');
  });
});

describe('titleNames', () => {
  it('un nom par langue, le français à la place d\'une traduction absente ou vide', () => {
    expect(titleNames({ fr: 'Pain', en: 'Bread', es: 'Pan', pt: 'Pão' })).toEqual(['Pain', 'Bread', 'Pan', 'Pão']);
    expect(titleNames({ fr: 'Pain', en: '', pt: 'Pão' })).toEqual(['Pain', 'Pain', 'Pain', 'Pão']);
    expect(titleNames({ fr: 'Anneau{[~1]?x:}', pt: 'An{[~1]?éis:el}' }, singularTitle)).toEqual(['Anneau', 'Anneau', 'Anneau', 'Anel']);
  });
});
