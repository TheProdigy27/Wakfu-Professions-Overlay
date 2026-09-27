// Petites données au format Ankama (avec des champs superflus, comme les vraies) et faux CDN, pour les tests hors réseau.
import type { GameIndexFile, Names, RecipeTuple } from '../../src/core/data/indexFile';
import { INDEX_SCHEMA } from '../../src/core/data/indexFile';
import type { FetchLike } from '../../src/main/data/gamedataService';

export const SMALL_COUNTS = { recipes: 1, items: 1, jobs: 1 };

export interface SyntheticOptions {
  /** Blé par Farine (recette R10). */
  flourQty?: number;
  /** Ajoute la Levure (id 5) au Pain : absente de jobsItems.json, présente dans items.json. */
  withYeast?: boolean;
}

/**
 * Noms traduits. Farine : espagnol vide et portugais absent, remplacés par le français. Les autres noms sont les
 * mêmes dans toutes les langues (« en » recopie le français, es et pt sont absents).
 */
const TRANSLATIONS: Readonly<Record<string, { en?: string; es?: string; pt?: string }>> = {
  Boulanger: { en: 'Baker', es: 'Panadero', pt: 'Padeiro' },
  Blé: { en: 'Wheat', es: 'Trigo', pt: 'Trigo' },
  Farine: { en: 'Flour', es: '' },
};

/**
 * Objets : 1 Blé, 2 Farine, 3 Pain, 4 Eau (5 Levure dans items.json seulement).
 * R10 Farine ← Blé ; R11 Pain ×4 ← Farine, Eau ; R12 métier archivé ; R13 sans ingrédient ;
 * R14 amélioration à deux résultats (Blé ×3 en productOrder 0).
 */
export function syntheticRaw(options: SyntheticOptions = {}): Record<string, unknown> {
  const recipe = (id: number, categoryId: number, level: number, isUpgrade = false) => ({
    id, categoryId, level, xpRatio: 100, isUpgrade, upgradeItemId: 0,
  });
  const ing = (recipeId: number, itemId: number, quantity: number, ingredientOrder: number) => ({
    recipeId, itemId, quantity, ingredientOrder,
  });
  const result = (recipeId: number, productedItemId: number, productedItemQuantity: number, productOrder = 0) => ({
    recipeId, productedItemId, productOrder, productedItemQuantity,
  });
  const job = (id: number, fr: string, flags: Partial<Record<'isArchive' | 'isHidden' | 'isNoCraft', boolean>> = {}) => ({
    definition: { id, isArchive: false, isNoCraft: false, isHidden: false, xpFactor: 1, isInnate: false, ...flags },
    title: { fr, en: fr, ...TRANSLATIONS[fr] },
  });
  const jobItem = (id: number, fr: string, level: number, rarity: number) => ({
    definition: { id, level, rarity, itemTypeId: 1, graphicParameters: { gfxId: id * 100, femaleGfxId: id * 100 } },
    title: { fr, en: fr, ...TRANSLATIONS[fr] },
  });
  return {
    recipes: [recipe(10, 40, 5), recipe(11, 40, 10), recipe(12, 99, 1), recipe(13, 40, 1), recipe(14, 40, 3, true)],
    recipeIngredients: [
      ing(10, 1, options.flourQty ?? 2, 0),
      ing(11, 4, 1, 1),
      ing(11, 2, 1, 0),
      ...(options.withYeast ? [ing(11, 5, 1, 2)] : []),
      ing(12, 4, 1, 0),
      ing(14, 4, 2, 0),
    ],
    recipeResults: [result(10, 2, 1), result(11, 3, 4), result(12, 1, 1), result(13, 1, 1), result(14, 4, 1, 1), result(14, 1, 3, 0)],
    recipeCategories: [
      job(40, 'Boulanger'),
      job(99, 'Ancien', { isArchive: true }),
      job(97, 'Caché', { isHidden: true }),
      job(96, 'Sans craft', { isNoCraft: true }),
    ],
    jobsItems: [jobItem(1, 'Blé', 1, 1), jobItem(2, 'Farine', 5, 1), jobItem(3, 'Pain', 10, 2), jobItem(4, "Seau d'eau", 1, 1)],
    itemTypes: [
      {
        definition: { id: 1, isRecyclable: true },
        title: { fr: 'Céréale{[~1]?s:}', en: 'Cereal{[~1]?s:}', es: 'Cereal{[~1]?es:}', pt: 'Cerea{[~1]?is:l}' },
      },
      { definition: { id: 2, isRecyclable: false } },
    ],
    items: [
      {
        definition: {
          item: {
            id: 5,
            level: 3,
            baseParameters: { itemTypeId: 1, itemSetId: 0, rarity: 1 },
            graphicParameters: { gfxId: 500, femaleGfxId: 500 },
            properties: [],
          },
          equipEffects: [],
          useEffects: [],
        },
        title: { fr: 'Levure' },
        description: {},
      },
    ],
  };
}

/** Faux CDN : config.json et {version}/{fichier}.json servis depuis la mémoire. */
export function mockCdn(versions: Record<string, Record<string, unknown>>, current: string) {
  const state = { online: true, version: current, failOn: undefined as string | undefined, configBody: undefined as unknown };
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    const rel = url.replace(`${CDN}/`, '');
    calls.push(rel);
    if (!state.online) throw new TypeError('fetch failed');
    if (rel === state.failOn) return new Response('erreur', { status: 500 });
    if (rel === 'config.json') return Response.json(state.configBody ?? { version: state.version });
    const [version, file] = rel.split('/');
    const body = versions[version!]?.[file!.replace(/\.json$/, '')];
    return body === undefined ? new Response('absent', { status: 404 }) : Response.json(body);
  };
  return { fetch, calls, state };
}

export const CDN = 'https://cdn.test/gamedata';

/** Même nom dans les quatre langues, ou un nom par langue (fr, en, es, pt). */
export type SyntheticName = string | Names;
export type SyntheticItem = [id: number, name: SyntheticName, level: number, rarity: number, typeId: number, gfxId: number];

const names = (name: SyntheticName): Names => (typeof name === 'string' ? [name, name, name, name] : name);

/** Petit index compact écrit à la main (cycles, ids inconnus…). */
export function indexFile(partial: {
  jobs?: [number, SyntheticName][];
  types?: [number, SyntheticName][];
  items?: SyntheticItem[];
  recipes?: RecipeTuple[];
}): GameIndexFile {
  return {
    indexSchema: INDEX_SCHEMA,
    gameVersion: 'test',
    builtAt: 'test',
    jobs: (partial.jobs ?? [[1, 'Test']]).map(([id, name]) => [id, names(name)]),
    types: (partial.types ?? []).map(([id, name]) => [id, names(name)]),
    items: (partial.items ?? []).map(([id, name, ...rest]) => [id, names(name), ...rest]),
    recipes: partial.recipes ?? [],
  };
}
