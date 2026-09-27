// Migrations de state.json : MIGRATIONS[n] passe du format n au format n + 1, dans l'ordre, au chargement.
import { PersistedStateSchema, STATE_SCHEMA_VERSION, type PersistedState } from './schema';

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /** Réglage de la langue : celle de Windows tant qu'on n'en a pas choisi une. */
  1: (state) => ({ ...state, settings: { ...(state['settings'] as object), language: null } }),
  /** Réglage « Afficher le panneau au lancement de Wakfu », désactivé. */
  2: (state) => ({ ...state, settings: { ...(state['settings'] as object), showWithWakfu: false } }),
  /** Niveaux de métier des crafts par métier : aucun indiqué. */
  3: (state) => ({ ...state, jobLevels: {} }),
};

/** Fichier écrit par une version plus récente de l'application : on ne sait pas le relire, il ne doit pas être écrasé. */
export class NewerStateError extends Error {
  constructor(readonly version: number) {
    super(`state.json au format ${version}, plus récent que celui de cette version de l'application (${STATE_SCHEMA_VERSION})`);
  }
}

/** Format d'un state.json lu, ou null s'il n'en indique pas. */
export function stateVersion(json: unknown): number | null {
  if (typeof json !== 'object' || json === null) return null;
  const version = (json as { schemaVersion?: unknown }).schemaVersion;
  return Number.isInteger(version) && (version as number) >= 0 ? (version as number) : null;
}

/** Applique les migrations jusqu'au format `target`, sans valider le résultat. */
export function migrate(
  json: unknown,
  target: number = STATE_SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Record<string, unknown> {
  let version = stateVersion(json);
  if (version === null) throw new Error('state.json sans numéro de format (schemaVersion)');
  if (version > target) throw new NewerStateError(version);
  let state = json as Record<string, unknown>;
  for (; version < target; version++) {
    const step = migrations[version];
    if (!step) throw new Error(`migration de state.json ${version} → ${version + 1} absente`);
    state = { ...step(state), schemaVersion: version + 1 };
  }
  return state;
}

/** state.json lu → état courant validé. Lève une erreur si le fichier est illisible, et NewerStateError s'il est trop récent. */
export function parseState(json: unknown, migrations: Readonly<Record<number, Migration>> = MIGRATIONS): PersistedState {
  return PersistedStateSchema.parse(migrate(json, STATE_SCHEMA_VERSION, migrations));
}
