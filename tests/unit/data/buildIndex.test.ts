import { describe, expect, it } from 'vitest';
import { buildIndex, DataBuildError, singularTitle } from '../../../src/core/data/buildIndex';
import { INDEX_SCHEMA } from '../../../src/core/data/indexFile';
import { parseItemsFallback, parseRawFile, RAW_FILE_NAMES, type RawGamedata } from '../../../src/core/data/rawSchemas';
import { SMALL_COUNTS, syntheticRaw, type SyntheticOptions } from '../../helpers/synthetic';

function parsed(options?: SyntheticOptions): { raw: RawGamedata; json: Record<string, unknown> } {
  const json = syntheticRaw(options);
  const raw = Object.fromEntries(RAW_FILE_NAMES.map((n) => [n, parseRawFile(n, json[n])])) as RawGamedata;
  return { raw, json };
}

const builtAt = new Date('2026-09-26T12:00:00Z');

describe('buildIndex', () => {
  it('construit un index compact trié et déterministe', () => {
    const { file, report } = buildIndex('1.0', parsed().raw, { minCounts: SMALL_COUNTS, builtAt });
    expect(file).toEqual({
      indexSchema: INDEX_SCHEMA,
      gameVersion: '1.0',
      builtAt: '2026-09-26T12:00:00.000Z',
      jobs: [[40, 'Boulanger']],
      types: [[1, 'Céréale']],
      items: [
        [1, 'Blé', 1, 1, 1, 100],
        [2, 'Farine', 5, 1, 1, 200],
        [3, 'Pain', 10, 2, 1, 300],
        [4, "Seau d'eau", 1, 1, 1, 400],
      ],
      recipes: [
        [10, 40, 5, 0, 2, 1, [1, 2]],
        // Ingrédients dans l'ordre ingredientOrder, pas dans l'ordre du fichier.
        [11, 40, 10, 0, 3, 4, [2, 1, 4, 1]],
        // Deux résultats : celui de productOrder 0.
        [14, 40, 3, 1, 1, 3, [4, 2]],
      ],
    });
    expect(report).toEqual({
      recipes: 3,
      excludedRecipes: 2, // R12 (métier archivé), R13 (sans ingrédient)
      items: 4,
      missingItemIds: [],
      itemsFromFallback: 0,
      multiResultRecipes: 1,
    });
  });

  it('signale les ids absents de jobsItems.json, puis les résout avec items.json', () => {
    const { raw, json } = parsed({ withYeast: true });
    const without = buildIndex('1.0', raw, { minCounts: SMALL_COUNTS });
    expect(without.report.missingItemIds).toEqual([5]);
    expect(without.file.items.map((i) => i[0])).toEqual([1, 2, 3, 4]);

    const withFallback = buildIndex('1.0', raw, { minCounts: SMALL_COUNTS, itemsFallback: parseItemsFallback(json.items) });
    expect(withFallback.report).toMatchObject({ missingItemIds: [], itemsFromFallback: 1 });
    expect(withFallback.file.items.at(-1)).toEqual([5, 'Levure', 3, 1, 1, 500]);
  });

  it('refuse des données trop maigres (format probablement changé)', () => {
    expect(() => buildIndex('1.0', parsed().raw)).toThrow(DataBuildError);
    expect(() => buildIndex('1.0', parsed().raw, { minCounts: { recipes: 1, items: 1, jobs: 2 } })).toThrow(
      'jobs : 1 entrées, minimum attendu 2',
    );
  });
});

describe('singularTitle', () => {
  it('retire le gabarit de pluriel', () => {
    expect(singularTitle('Anneau{[~1]?x:}')).toBe('Anneau');
    expect(singularTitle('Hache{[~1]?s:} (Deux mains)')).toBe('Hache (Deux mains)');
    expect(singularTitle('Cheva{[~1]?ux:l}')).toBe('Cheval');
    expect(singularTitle('Ressource')).toBe('Ressource');
  });
});
