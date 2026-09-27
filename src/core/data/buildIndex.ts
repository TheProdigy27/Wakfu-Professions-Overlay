// Construction de l'index compact à partir des fichiers bruts validés.
import { LOCALES } from '../i18n/locale';
import { INDEX_SCHEMA, type GameIndexFile, type ItemTuple, type Names, type RecipeTuple } from './indexFile';
import type { RawGamedata, RawItem, RawTitle } from './rawSchemas';

export interface BuildReport {
  recipes: number;
  /** Recettes écartées : métier archivé, caché ou sans craft, ou recette sans résultat ni ingrédient. */
  excludedRecipes: number;
  items: number;
  /** Ids cités par une recette et absents de jobsItems.json (et de items.json s'il est fourni). */
  missingItemIds: number[];
  /** Ids trouvés seulement dans items.json. */
  itemsFromFallback: number;
  multiResultRecipes: number;
}

/** Nombres d'entrées en dessous desquels on considère que le format des données a changé. */
export interface MinCounts {
  recipes: number;
  items: number;
  jobs: number;
}

export const DEFAULT_MIN_COUNTS: MinCounts = { recipes: 1000, items: 1000, jobs: 5 };

export interface BuildOptions {
  minCounts?: MinCounts;
  /** items.json, en repli quand jobsItems.json ne couvre pas tous les ids. */
  itemsFallback?: RawItem[];
  builtAt?: Date;
}

/** Les données sont lisibles mais incohérentes (trop peu d'entrées) : on garde l'index précédent. */
export class DataBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataBuildError';
  }
}

/** Retire le gabarit de pluriel d'Ankama : "Anneau{[~1]?x:}" → "Anneau", "An{[~1]?éis:el}" → "Anel". */
export function singularTitle(title: string): string {
  return title.replace(/\{\[~1\]\?([^:}]*):([^}]*)\}/g, '$2');
}

/** Nom dans chaque langue de l'interface ; le français remplace une traduction absente ou vide. */
export function titleNames(title: RawTitle, transform: (name: string) => string = (name) => name): Names {
  return LOCALES.map((locale) => transform(title[locale] || title.fr)) as Names;
}

function groupBy<T>(values: readonly T[], key: (v: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const v of values) {
    const k = key(v);
    const list = out.get(k);
    if (list) list.push(v);
    else out.set(k, [v]);
  }
  return out;
}

export function buildIndex(
  version: string,
  raw: RawGamedata,
  options: BuildOptions = {},
): { file: GameIndexFile; report: BuildReport } {
  const minCounts = options.minCounts ?? DEFAULT_MIN_COUNTS;

  const jobs = new Map<number, Names>();
  for (const c of raw.recipeCategories) {
    const d = c.definition;
    if (!d.isArchive && !d.isHidden && !d.isNoCraft) jobs.set(d.id, titleNames(c.title));
  }

  const resultsByRecipe = groupBy(raw.recipeResults, (r) => r.recipeId);
  const ingsByRecipe = groupBy(raw.recipeIngredients, (g) => g.recipeId);

  const recipes: RecipeTuple[] = [];
  const referenced = new Set<number>();
  let excluded = 0;
  let multiResult = 0;
  for (const r of raw.recipes) {
    const results = resultsByRecipe.get(r.id);
    const ings = ingsByRecipe.get(r.id);
    if (!jobs.has(r.categoryId) || !results?.length || !ings?.length) {
      excluded++;
      continue;
    }
    if (results.length > 1) multiResult++;
    const out = results.reduce((a, b) => (b.productOrder < a.productOrder ? b : a));
    const flat: number[] = [];
    for (const g of [...ings].sort((a, b) => a.ingredientOrder - b.ingredientOrder)) {
      flat.push(g.itemId, g.quantity);
      referenced.add(g.itemId);
    }
    referenced.add(out.productedItemId);
    recipes.push([r.id, r.categoryId, r.level, r.isUpgrade ? 1 : 0, out.productedItemId, out.productedItemQuantity, flat]);
  }
  recipes.sort((a, b) => a[0] - b[0]);

  const fromJobs = new Map(raw.jobsItems.map((x) => [x.definition.id, x]));
  const fromItems = new Map((options.itemsFallback ?? []).map((x) => [x.definition.item.id, x]));
  const items: ItemTuple[] = [];
  const missing: number[] = [];
  let fallbackCount = 0;
  for (const id of [...referenced].sort((a, b) => a - b)) {
    const j = fromJobs.get(id);
    if (j) {
      const d = j.definition;
      items.push([id, titleNames(j.title), d.level, d.rarity, d.itemTypeId, d.graphicParameters.gfxId]);
      continue;
    }
    const i = fromItems.get(id);
    if (i) {
      const d = i.definition.item;
      items.push([id, titleNames(i.title), d.level, d.baseParameters.rarity, d.baseParameters.itemTypeId, d.graphicParameters.gfxId]);
      fallbackCount++;
      continue;
    }
    missing.push(id);
  }

  const types: [number, Names][] = [];
  for (const t of raw.itemTypes) {
    const fr = t.title?.fr;
    if (fr) types.push([t.definition.id, titleNames({ ...t.title, fr }, singularTitle)]);
  }
  types.sort((a, b) => a[0] - b[0]);

  const counts = { recipes: recipes.length, items: items.length, jobs: jobs.size };
  for (const key of ['recipes', 'items', 'jobs'] as const) {
    if (counts[key] < minCounts[key]) {
      throw new DataBuildError(`${key} : ${counts[key]} entrées, minimum attendu ${minCounts[key]}`);
    }
  }

  return {
    file: {
      indexSchema: INDEX_SCHEMA,
      gameVersion: version,
      builtAt: (options.builtAt ?? new Date()).toISOString(),
      jobs: [...jobs.entries()].sort((a, b) => a[0] - b[0]),
      types,
      items,
      recipes,
    },
    report: {
      recipes: recipes.length,
      excludedRecipes: excluded,
      items: items.length,
      missingItemIds: missing,
      itemsFromFallback: fallbackCount,
      multiResultRecipes: multiResult,
    },
  };
}
