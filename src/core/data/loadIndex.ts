// Index en mémoire (Maps) construit à partir de l'index compact, avec les noms d'une langue.
import { LOCALES, type Locale } from '../i18n/locale';
import type { GameIndexFile } from './indexFile';

export interface Item {
  id: number;
  /** Dans la langue de l'index. */
  name: string;
  level: number;
  rarity: number;
  typeId: number;
  gfxId: number;
}

export interface Ingredient {
  itemId: number;
  qty: number;
}

export interface Recipe {
  id: number;
  jobId: number;
  jobLevel: number;
  isUpgrade: boolean;
  /** Objet produit. */
  out: number;
  /** Quantité produite par craft. */
  yield: number;
  ings: Ingredient[];
}

export interface GameIndex {
  version: string;
  /** Langue des noms d'objets, de métiers et de types. */
  locale: Locale;
  items: Map<number, Item>;
  recipes: Map<number, Recipe>;
  /** Recettes par objet produit, triées par niveau de métier puis id : la première est la recette par défaut. */
  recipesByItem: Map<number, Recipe[]>;
  jobs: Map<number, string>;
  types: Map<number, string>;
}

export function loadIndex(file: GameIndexFile, locale: Locale): GameIndex {
  const lang = LOCALES.indexOf(locale);
  const items = new Map<number, Item>();
  for (const [id, names, level, rarity, typeId, gfxId] of file.items) {
    items.set(id, { id, name: names[lang]!, level, rarity, typeId, gfxId });
  }
  const recipes = new Map<number, Recipe>();
  const recipesByItem = new Map<number, Recipe[]>();
  for (const [id, jobId, jobLevel, isUpgrade, out, outQty, flat] of file.recipes) {
    const ings: Ingredient[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) ings.push({ itemId: flat[i]!, qty: flat[i + 1]! });
    const recipe: Recipe = { id, jobId, jobLevel, isUpgrade: isUpgrade === 1, out, yield: outQty, ings };
    recipes.set(id, recipe);
    const list = recipesByItem.get(out);
    if (list) list.push(recipe);
    else recipesByItem.set(out, [recipe]);
  }
  for (const list of recipesByItem.values()) list.sort((a, b) => a.jobLevel - b.jobLevel || a.id - b.id);
  return {
    version: file.gameVersion,
    locale,
    items,
    recipes,
    recipesByItem,
    jobs: new Map(file.jobs.map(([id, names]) => [id, names[lang]!])),
    types: new Map(file.types.map(([id, names]) => [id, names[lang]!])),
  };
}

export function isCraftable(index: GameIndex, itemId: number): boolean {
  return index.recipesByItem.has(itemId);
}

/** Recette par défaut : niveau de métier minimal, puis id minimal. */
export function defaultRecipe(index: GameIndex, itemId: number): Recipe | undefined {
  return index.recipesByItem.get(itemId)?.[0];
}
