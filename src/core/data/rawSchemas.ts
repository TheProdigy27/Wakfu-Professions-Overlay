// Schémas des fichiers bruts du CDN Ankama. Seuls les champs utilisés sont vérifiés (les autres sont ignorés).
import { z } from 'zod';

const id = z.number().int().nonnegative();
const int = z.number().int();
/** Nom dans les langues de l'interface. Le français est toujours présent : il remplace une traduction absente. */
const title = z.object({
  fr: z.string(),
  en: z.string().optional(),
  es: z.string().optional(),
  pt: z.string().optional(),
});

export const ConfigSchema = z.object({ version: z.string().regex(/^\d+(\.\d+)+$/) });

export const RawRecipeSchema = z.object({
  id,
  categoryId: id,
  level: int,
  isUpgrade: z.boolean(),
  upgradeItemId: id,
});

export const RawIngredientSchema = z.object({
  recipeId: id,
  itemId: id,
  quantity: z.number().int().positive(),
  ingredientOrder: int,
});

export const RawResultSchema = z.object({
  recipeId: id,
  productedItemId: id,
  productOrder: int,
  productedItemQuantity: z.number().int().positive(),
});

export const RawCategorySchema = z.object({
  definition: z.object({ id, isArchive: z.boolean(), isNoCraft: z.boolean(), isHidden: z.boolean() }),
  title,
});

export const RawJobItemSchema = z.object({
  definition: z.object({
    id,
    level: int,
    rarity: int,
    itemTypeId: id,
    graphicParameters: z.object({ gfxId: id }),
  }),
  title,
});

export const RawItemTypeSchema = z.object({
  definition: z.object({ id }),
  // 2 types n'ont pas de titre en 1.93.1.62.
  title: title.partial().nullish(),
});

/** items.json : téléchargé seulement en repli, si jobsItems.json ne couvre plus tous les ids. */
export const RawItemSchema = z.object({
  definition: z.object({
    item: z.object({
      id,
      level: int,
      baseParameters: z.object({ itemTypeId: id, rarity: int }),
      graphicParameters: z.object({ gfxId: id }),
    }),
  }),
  title,
});

/** Les 6 fichiers toujours téléchargés (≈ 9,3 Mo en 1.93.1.62). */
export const RAW_FILE_SCHEMAS = {
  recipes: z.array(RawRecipeSchema),
  recipeIngredients: z.array(RawIngredientSchema),
  recipeResults: z.array(RawResultSchema),
  recipeCategories: z.array(RawCategorySchema),
  jobsItems: z.array(RawJobItemSchema),
  itemTypes: z.array(RawItemTypeSchema),
} as const;

export const ITEMS_FALLBACK_SCHEMA = z.array(RawItemSchema);

export type RawFileName = keyof typeof RAW_FILE_SCHEMAS;
export const RAW_FILE_NAMES = Object.keys(RAW_FILE_SCHEMAS) as RawFileName[];

export type RawGamedata = { [K in RawFileName]: z.infer<(typeof RAW_FILE_SCHEMAS)[K]> };

/** Récolte d'une ressource : skillId est l'id du métier de récolte (73 Mineur…), comme dans recipeCategories.json. */
export const RawCollectibleSchema = z.object({
  skillId: id,
  skillLevelRequired: int,
  /** 0 : rien de récolté directement, seulement le butin. */
  collectItemId: id,
  collectLootListId: id,
});

export const RawHarvestLootSchema = z.object({ itemId: id, listId: id });

/**
 * Provenance des ressources (≈ 430 Ko) : facultative. Absents (données téléchargées par une version précédente
 * de l'application) ou d'un format inattendu, l'index est construit sans.
 */
export const HARVEST_FILE_SCHEMAS = {
  collectibleResources: z.array(RawCollectibleSchema),
  harvestLoots: z.array(RawHarvestLootSchema),
} as const;

export type HarvestFileName = keyof typeof HARVEST_FILE_SCHEMAS;
export const HARVEST_FILE_NAMES = Object.keys(HARVEST_FILE_SCHEMAS) as HarvestFileName[];

export type RawHarvest = { [K in HarvestFileName]: z.infer<(typeof HARVEST_FILE_SCHEMAS)[K]> };

/** Plan : objet à utiliser une fois pour apprendre des recettes (souvent une même recette en plusieurs raretés). */
export const RawBlueprintSchema = z.object({ blueprintId: id, recipeId: z.array(id) });

/**
 * Plans requis (≈ 5 Ko) : facultatif, comme les fichiers de récolte. Absent ou d'un format inattendu, l'index est
 * construit sans.
 */
export const BLUEPRINTS_FILE_NAME = 'blueprints';
export const BLUEPRINTS_SCHEMA = z.array(RawBlueprintSchema);
export type RawBlueprint = z.infer<typeof RawBlueprintSchema>;

/** Fichiers téléchargés pour chaque version du jeu (items.json en plus, en repli). */
export const DOWNLOADED_FILE_NAMES: readonly string[] = [...RAW_FILE_NAMES, ...HARVEST_FILE_NAMES, BLUEPRINTS_FILE_NAME];
export type RawItem = z.infer<typeof RawItemSchema>;
export type RawTitle = z.infer<typeof title>;

/** Le format d'un fichier Ankama ne correspond plus à ce que l'application sait lire. */
export class DataFormatError extends Error {
  constructor(
    readonly file: string,
    readonly detail: string,
  ) {
    super(`${file} : format inattendu (${detail})`);
    this.name = 'DataFormatError';
  }
}

function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'erreur de validation';
  const where = issue.path.length ? issue.path.join('.') : 'racine';
  return `${where} : ${issue.message}`;
}

/** Valide le contenu JSON d'un fichier brut ; lève DataFormatError sinon. */
export function parseRawFile<K extends RawFileName>(name: K, json: unknown): RawGamedata[K] {
  const result = RAW_FILE_SCHEMAS[name].safeParse(json);
  if (!result.success) throw new DataFormatError(`${name}.json`, describeIssue(result.error));
  return result.data as RawGamedata[K];
}

export function parseHarvestFile<K extends HarvestFileName>(name: K, json: unknown): RawHarvest[K] {
  const result = HARVEST_FILE_SCHEMAS[name].safeParse(json);
  if (!result.success) throw new DataFormatError(`${name}.json`, describeIssue(result.error));
  return result.data as RawHarvest[K];
}

export function parseBlueprints(json: unknown): RawBlueprint[] {
  const result = BLUEPRINTS_SCHEMA.safeParse(json);
  if (!result.success) throw new DataFormatError(`${BLUEPRINTS_FILE_NAME}.json`, describeIssue(result.error));
  return result.data;
}

export function parseItemsFallback(json: unknown): RawItem[] {
  const result = ITEMS_FALLBACK_SCHEMA.safeParse(json);
  if (!result.success) throw new DataFormatError('items.json', describeIssue(result.error));
  return result.data;
}

export function parseConfig(json: unknown): string {
  const result = ConfigSchema.safeParse(json);
  if (!result.success) throw new DataFormatError('config.json', describeIssue(result.error));
  return result.data.version;
}
