// Crafts par métier : les objets qu'un métier fabrique, groupés par niveau de métier, jusqu'au niveau du joueur.
import type { GameIndex, Item, Recipe } from '../data/loadIndex';
import { normalize } from '../match/normalize';

/** Niveau du joueur par métier (jobId → niveau) ; absent : pas de filtre de niveau. */
export type JobLevels = Record<number, number>;

export const MAX_JOB_LEVEL = 999;

export interface JobCraft {
  item: Item;
  /** Recette la plus basse de l'objet dans ce métier (les variantes n'ajoutent pas de ligne). */
  recipe: Recipe;
}

export interface JobCraftGroup {
  level: number;
  crafts: JobCraft[];
}

export interface JobCraftFilter {
  /** Seulement les recettes de ce niveau de métier ou moins. */
  maxLevel?: number;
  /** Partie du nom, sans tenir compte des accents ni des majuscules. */
  query?: string;
  /** false : sans les recettes d'amélioration (rareté supérieure). */
  upgrades?: boolean;
}

export interface JobCraftList {
  groups: JobCraftGroup[];
  /** Crafts affichés. */
  shown: number;
  /** Crafts du métier, sans filtre. */
  total: number;
}

/** Métiers triés par nom dans la langue de l'index. */
export function jobsByName(index: GameIndex): { id: number; name: string }[] {
  const collator = new Intl.Collator(index.locale);
  return [...index.jobs]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id);
}

/** Crafts du métier : par niveau de métier croissant, puis par nom, puis par rareté. */
export function jobCrafts(index: GameIndex, jobId: number, filter: JobCraftFilter = {}): JobCraftList {
  const all: JobCraft[] = [];
  for (const [itemId, recipes] of index.recipesByItem) {
    const recipe = recipes.find((r) => r.jobId === jobId);
    const item = index.items.get(itemId);
    if (recipe && item) all.push({ item, recipe });
  }
  const query = normalize(filter.query ?? '');
  const shown = all.filter(
    ({ item, recipe }) =>
      (filter.maxLevel === undefined || recipe.jobLevel <= filter.maxLevel) &&
      (filter.upgrades !== false || !recipe.isUpgrade) &&
      (!query || normalize(item.name).includes(query)),
  );
  const collator = new Intl.Collator(index.locale);
  shown.sort(
    (a, b) =>
      a.recipe.jobLevel - b.recipe.jobLevel ||
      collator.compare(a.item.name, b.item.name) ||
      a.item.rarity - b.item.rarity ||
      a.item.id - b.item.id,
  );
  const groups: JobCraftGroup[] = [];
  for (const craft of shown) {
    const last = groups.at(-1);
    if (last?.level === craft.recipe.jobLevel) last.crafts.push(craft);
    else groups.push({ level: craft.recipe.jobLevel, crafts: [craft] });
  }
  return { groups, shown: shown.length, total: all.length };
}

/** Niveau saisi pour un métier ; null (champ vidé) ou valeur non numérique : plus de filtre de niveau. */
export function withJobLevel(levels: JobLevels, jobId: number, level: number | null): JobLevels {
  const next = { ...levels };
  if (level === null || !Number.isFinite(level)) delete next[jobId];
  else next[jobId] = Math.min(MAX_JOB_LEVEL, Math.max(0, Math.floor(level)));
  return next;
}
