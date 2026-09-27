import { describe, expect, it } from 'vitest';
import { INDEX_SCHEMA, parseIndexFile, readIndexHeader } from '../../../src/core/data/indexFile';
import { defaultRecipe, isCraftable, loadIndex } from '../../../src/core/data/loadIndex';
import type { Locale } from '../../../src/core/i18n';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';
import { indexFile } from '../../helpers/synthetic';

describe('loadIndex', () => {
  const { file, index } = loadFixture();

  it('charge objets, recettes, métiers et types', () => {
    expect(index.version).toBe(file.gameVersion);
    expect(index.items.size).toBe(file.items.length);
    expect(index.recipes.size).toBe(file.recipes.length);
    expect(index.items.get(IDS.COIFFE_L)).toMatchObject({ name: 'Coiffe Lardante', rarity: 4, level: 125 });
    expect(index.jobs.get(81)).toBe('Ébéniste');
    expect(index.locale).toBe('fr');
  });

  it('noms des objets, métiers et types dans la langue demandée', () => {
    const names = (locale: Locale) => {
      const idx = loadFixture(locale).index;
      return [idx.items.get(IDS.COIFFE_L)!.name, idx.jobs.get(81), idx.types.get(idx.items.get(IDS.COIFFE_L)!.typeId)];
    };
    expect(names('fr')).toEqual(['Coiffe Lardante', 'Ébéniste', 'Casque']);
    expect(names('en')).toEqual(['Larduous Hat', 'Handyman', 'Helmet']);
    expect(names('es')).toEqual(['Sombrero de Pan Z', 'Ebanista', 'Casco']);
    expect(names('pt')).toEqual(['Chapéu Banhoso', 'Marceneiro', 'Capacete']);
  });

  it('trie les recettes par niveau de métier puis id : la première est la recette par défaut (T3a : R6446)', () => {
    const orbe = index.recipesByItem.get(IDS.ORBE)!.map((r) => r.id);
    expect(orbe).toEqual([6446, 6447, 6448, 6449, 7362, 7363, 7364]);
    expect(defaultRecipe(index, IDS.ORBE)?.id).toBe(6446);
    const pain = index.recipesByItem.get(IDS.PAIN_COMPLET)![0]!;
    expect(pain).toMatchObject({ id: 2403, yield: 4, isUpgrade: false });
    expect(isCraftable(index, IDS.ORBE)).toBe(true);
    expect(isCraftable(index, IDS.POUDRE)).toBe(false);
    expect(defaultRecipe(index, IDS.POUDRE)).toBeUndefined();
  });

  it('plan requis : sur chaque recette qu\'il apprend, objet « plan » dans l\'index', () => {
    const kokordon = [...index.items.values()].filter((i) => i.name === 'Kokordon');
    expect(kokordon).toHaveLength(3);
    for (const item of kokordon) expect(index.recipesByItem.get(item.id)![0]!.plan).toBe(19804);
    expect(index.items.get(19804)?.name).toBe('Plan "Kokordon"');
    expect(index.recipes.get(6446)!.plan).toBeUndefined();
    // Plan d'une recette absente : ignoré.
    const idx = loadIndex(indexFile({ items: [[1, 'A', 1, 1, 0, 0]], recipes: [[10, 1, 5, 0, 1, 1, [1, 1]]], plans: [[99, 7]] }), 'fr');
    expect(idx.recipes.get(10)!.plan).toBeUndefined();
  });

  it('départage deux recettes de même niveau par id', () => {
    const idx = loadIndex(
      indexFile({
        items: [[1, 'A', 1, 1, 0, 0]],
        recipes: [
          [30, 1, 5, 0, 1, 1, [1, 1]],
          [20, 1, 5, 0, 1, 1, [1, 1]],
          [10, 1, 9, 0, 1, 1, [1, 1]],
        ],
      }),
      'fr',
    );
    expect(idx.recipesByItem.get(1)!.map((r) => r.id)).toEqual([20, 30, 10]);
  });
});

describe('parseIndexFile', () => {
  const { file } = loadFixture();

  it('accepte la fixture et ignore les clés inconnues (_note)', () => {
    expect(parseIndexFile(JSON.parse(JSON.stringify(file))).items.length).toBe(file.items.length);
  });

  it("refuse un index d'un autre format", () => {
    expect(() => parseIndexFile({ ...file, indexSchema: INDEX_SCHEMA + 1 })).toThrow();
    expect(() => parseIndexFile({ ...file, items: [[1, ['A', 'A', 'A', 'A'], 1, 1, 0]] })).toThrow();
    // Index au format 1 : un seul nom, en français.
    expect(() => parseIndexFile({ ...file, items: [[1, 'A', 1, 1, 0, 0]] })).toThrow();
    expect(() => parseIndexFile({ ...file, recipes: [[1, 1, 1, 2, 1, 1, []]] })).toThrow();
    expect(() => parseIndexFile(null)).toThrow();
  });

  it("lit l'en-tête sans valider le reste", () => {
    expect(readIndexHeader({ indexSchema: 0, gameVersion: '1.2', items: 'n/a' })).toMatchObject({ indexSchema: 0, gameVersion: '1.2' });
    expect(readIndexHeader('texte')).toEqual({});
    expect(readIndexHeader(undefined)).toEqual({});
  });
});
