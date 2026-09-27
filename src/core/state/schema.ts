// État sauvegardé dans state.json : schéma zod de la version courante et valeurs par défaut.
// Chaque changement de forme passe par une migration (migrations.ts) et une fixture tests/fixtures/state-v{n}.json.
import { z } from 'zod';
import { MAX_HISTORY, MAX_QTY, type CraftList, type RecipePrefs } from './craftList';
import { DEFAULT_HOTKEY } from './hotkey';

export const STATE_SCHEMA_VERSION = 1;
export const MIN_OPACITY = 0.3;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Settings {
  hotkeys: { toggle: string };
  /** Entre MIN_OPACITY et 1. */
  opacity: number;
  compact: boolean;
  /** Pris en compte au démarrage suivant. */
  hardwareAcceleration: boolean;
  autoUpdate: boolean;
  launchAtLogin: boolean;
  onboardingDone: boolean;
}

export interface PersistedState {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  settings: Settings;
  /** Position et taille du panneau par mode ; reprises seulement si elles sont encore sur un écran. */
  window: { normal?: Rect; compact?: Rect };
  recipePrefs: RecipePrefs;
  current: CraftList | null;
  /** Listes quittées, la plus récente en tête (MAX_HISTORY au plus). */
  history: CraftList[];
}

const int = z.number().int();
/** Les clés JSON sont des chaînes : « 23205 ». */
const idKey = z.string().regex(/^\d{1,9}$/);

const RectSchema = z.object({ x: int, y: int, width: int.positive(), height: int.positive() });

export const CraftListSchema: z.ZodType<CraftList> = z.object({
  id: z.string().min(1).max(100),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
  gameVersion: z.string().max(40),
  target: z.object({ itemId: int.nonnegative(), qty: int.min(1).max(MAX_QTY) }),
  owned: z.record(idKey, int.min(0).max(MAX_QTY)),
  mode: z.record(idKey, z.literal('buy')),
  recipeChoice: z.record(idKey, int),
  ui: z.object({
    view: z.enum(['tree', 'shopping', 'order']),
    missingOnly: z.boolean(),
    collapsed: z.array(z.string().max(200)).max(2000),
  }),
  snapshot: z.record(idKey, z.object({ recipeId: int, yield: int, ings: z.array(int) })),
});

export const HistorySchema = z.array(CraftListSchema).max(MAX_HISTORY);
export const RecipePrefsSchema: z.ZodType<RecipePrefs> = z.record(idKey, int);

export const SettingsSchema: z.ZodType<Settings> = z.object({
  hotkeys: z.object({ toggle: z.string().min(1).max(100) }),
  opacity: z.number().min(MIN_OPACITY).max(1),
  compact: z.boolean(),
  hardwareAcceleration: z.boolean(),
  autoUpdate: z.boolean(),
  launchAtLogin: z.boolean(),
  onboardingDone: z.boolean(),
});

export const PersistedStateSchema: z.ZodType<PersistedState> = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  settings: SettingsSchema,
  window: z.object({ normal: RectSchema.optional(), compact: RectSchema.optional() }),
  recipePrefs: RecipePrefsSchema,
  current: CraftListSchema.nullable(),
  history: HistorySchema,
});

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  hotkeys: { toggle: DEFAULT_HOTKEY },
  opacity: 0.95,
  compact: false,
  hardwareAcceleration: true,
  autoUpdate: true,
  launchAtLogin: false,
  onboardingDone: false,
};

export function defaultState(): PersistedState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    window: {},
    recipePrefs: {},
    current: null,
    history: [],
  };
}
