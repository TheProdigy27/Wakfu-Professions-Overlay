// Format de l'index compact écrit sur disque (data/index.json).
import { z } from 'zod';

/** Version du format d'index (côté code). La changer force la reconstruction depuis data/raw/{v}/. */
export const INDEX_SCHEMA = 1;

const int = z.number().int();

export const GameIndexFileSchema = z.object({
  indexSchema: z.literal(INDEX_SCHEMA),
  gameVersion: z.string().min(1),
  builtAt: z.string(),
  /** [id, nom fr] des métiers retenus. */
  jobs: z.array(z.tuple([int, z.string()])),
  /** [id, libellé fr au singulier] des types d'objet. */
  types: z.array(z.tuple([int, z.string()])),
  /** [id, nom fr, niveau, rareté, typeId, gfxId] des objets cités par une recette. */
  items: z.array(z.tuple([int, z.string(), int, int, int, int])),
  /** [id, métier, niveau de métier, amélioration 0|1, objet produit, quantité produite, ingrédients à plat]. */
  recipes: z.array(z.tuple([int, int, int, z.union([z.literal(0), z.literal(1)]), int, int, z.array(int)])),
});

export type GameIndexFile = z.infer<typeof GameIndexFileSchema>;
export type ItemTuple = GameIndexFile['items'][number];
export type RecipeTuple = GameIndexFile['recipes'][number];

export function parseIndexFile(json: unknown): GameIndexFile {
  return GameIndexFileSchema.parse(json);
}

/** En-tête d'un index sans le valider entièrement : sert à détecter un format d'index périmé. */
export function readIndexHeader(json: unknown): { indexSchema?: unknown; gameVersion?: unknown } {
  return typeof json === 'object' && json !== null ? (json as { indexSchema?: unknown; gameVersion?: unknown }) : {};
}
