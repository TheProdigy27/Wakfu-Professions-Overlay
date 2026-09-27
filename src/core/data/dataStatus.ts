// État des données du jeu, publié par GamedataService (main) et affiché par le panneau (renderer).

export type DataErrorCode = 'offline-no-data' | 'format' | 'network';

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
  error: null | { code: DataErrorCode; message: string };
  lastCheckAt: number | null;
}
