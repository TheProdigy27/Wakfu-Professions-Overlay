import { describe, expect, it } from 'vitest';
import { DataFormatError, parseBlueprints, parseConfig, parseItemsFallback, parseRawFile } from '../../../src/core/data/rawSchemas';
import { syntheticRaw } from '../../helpers/synthetic';

describe('schémas des fichiers bruts', () => {
  it('ignore les champs non utilisés', () => {
    const recipes = parseRawFile('recipes', syntheticRaw().recipes);
    expect(recipes[0]).toEqual({ id: 10, categoryId: 40, level: 5, isUpgrade: false, upgradeItemId: 0 });
  });

  it('accepte un type d\'objet sans titre', () => {
    expect(parseRawFile('itemTypes', [{ definition: { id: 2 } }, { definition: { id: 3 }, title: null }])).toHaveLength(2);
  });

  it('indique le fichier et le champ en cause quand le format change', () => {
    const bad = [{ id: 1, categoryId: 40, level: 5, isUpgrade: 'non', upgradeItemId: 0 }];
    expect(() => parseRawFile('recipes', bad)).toThrow(DataFormatError);
    expect(() => parseRawFile('recipes', bad)).toThrow(/^recipes\.json : format inattendu \(0\.isUpgrade : /);
    expect(() => parseRawFile('jobsItems', { not: 'an array' })).toThrow(/jobsItems\.json : format inattendu \(racine : /);
    expect(() => parseRawFile('recipeIngredients', [{ recipeId: 1, itemId: 2, quantity: 0, ingredientOrder: 0 }])).toThrow(
      /0\.quantity/,
    );
  });

  it('valide blueprints.json', () => {
    expect(parseBlueprints(syntheticRaw().blueprints)[0]).toEqual({ blueprintId: 6, recipeId: [11, 99] });
    expect(() => parseBlueprints([{ blueprintId: 6, recipeId: 11 }])).toThrow(/^blueprints\.json : format inattendu \(0\.recipeId : /);
  });

  it('valide config.json et items.json', () => {
    expect(parseConfig({ version: '1.93.1.62' })).toBe('1.93.1.62');
    expect(() => parseConfig({ version: 'latest' })).toThrow(/config\.json : format inattendu \(version : /);
    expect(parseItemsFallback(syntheticRaw().items)[0]?.definition.item.id).toBe(5);
    expect(() => parseItemsFallback([{ definition: {} }])).toThrow(/items\.json/);
  });
});
