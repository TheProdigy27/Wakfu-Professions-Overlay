import { describe, expect, it } from 'vitest';
import { INDEX_SCHEMA, parseIndexFile, readIndexHeader } from '../../../src/core/data/indexFile';
import { defaultRecipe, isCraftable, loadIndex } from '../../../src/core/data/loadIndex';
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
    expect(() => parseIndexFile({ ...file, items: [[1, 'A', 1, 1, 0]] })).toThrow();
    expect(() => parseIndexFile({ ...file, recipes: [[1, 1, 1, 2, 1, 1, []]] })).toThrow();
    expect(() => parseIndexFile(null)).toThrow();
  });

  it("lit l'en-tête sans valider le reste", () => {
    expect(readIndexHeader({ indexSchema: 0, gameVersion: '1.2', items: 'n/a' })).toMatchObject({ indexSchema: 0, gameVersion: '1.2' });
    expect(readIndexHeader('texte')).toEqual({});
    expect(readIndexHeader(undefined)).toEqual({});
  });
});
