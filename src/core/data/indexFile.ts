// Format de l'index compact écrit sur disque (data/index.json).
import { z } from 'zod';

/**
 * Version du format d'index (côté code). La changer force la reconstruction depuis data/raw/{v}/.
 * 2 : noms dans les quatre langues de l'interface.
 * 3 : provenance des ressources récoltées (harvest).
 */
export const INDEX_SCHEMA = 3;

const int = z.number().int();
/** Nom en fr, en, es et pt, dans l'ordre de LOCALES. */
const names = z.tuple([z.string(), z.string(), z.string(), z.string()]);

export const GameIndexFileSchema = z.object({
  indexSchema: z.literal(INDEX_SCHEMA),
  gameVersion: z.string().min(1),
  builtAt: z.string(),
  /** [id, noms] des métiers retenus. */
  jobs: z.array(z.tuple([int, names])),
  /** [id, libellés au singulier] des types d'objet. */
  types: z.array(z.tuple([int, names])),
  /** [id, noms, niveau, rareté, typeId, gfxId] des objets cités par une recette. */
  items: z.array(z.tuple([int, names, int, int, int, int])),
  /** [id, métier, niveau de métier, amélioration 0|1, objet produit, quantité produite, ingrédients à plat]. */
  recipes: z.array(z.tuple([int, int, int, z.union([z.literal(0), z.literal(1)]), int, int, z.array(int)])),
  /** [objet, métier de récolte, niveau requis] des ressources récoltées ; vide sans les fichiers de récolte. */
  harvest: z.array(z.tuple([int, int, int])),
});

export type GameIndexFile = z.infer<typeof GameIndexFileSchema>;
export type ItemTuple = GameIndexFile['items'][number];
export type RecipeTuple = GameIndexFile['recipes'][number];
export type HarvestTuple = GameIndexFile['harvest'][number];
export type Names = z.infer<typeof names>;

export function parseIndexFile(json: unknown): GameIndexFile {
  return GameIndexFileSchema.parse(json);
}

/** En-tête d'un index sans le valider entièrement : sert à détecter un format d'index périmé. */
export function readIndexHeader(json: unknown): { indexSchema?: unknown; gameVersion?: unknown } {
  return typeof json === 'object' && json !== null ? (json as { indexSchema?: unknown; gameVersion?: unknown }) : {};
}
