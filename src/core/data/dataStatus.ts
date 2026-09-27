// État des données du jeu, publié par GamedataService (main) et affiché par le panneau (renderer).

export type DataErrorCode = 'offline-no-data' | 'format' | 'network';

/** Traduite par le panneau (Messages.data.errors). */
export interface DataError {
  code: DataErrorCode;
  /** Version que l'on essayait d'installer, si elle est connue. */
  version: string | null;
  /** Version des données qui restent utilisées, null si aucune. */
  kept: string | null;
}

export interface DataStatus {
  /** Version des données chargées, null si aucune. */
  version: string | null;
  /** Dernière vérification impossible faute de réseau. */
  offline: boolean;
  busy:
    | null
    /** percent : part du téléchargement reçue (0 à 100), d'après la taille habituelle des fichiers. */
    | { step: 'download'; version: string; done: number; total: number; percent: number }
    | { step: 'build'; version: string };
  error: DataError | null;
  lastCheckAt: number | null;
}
