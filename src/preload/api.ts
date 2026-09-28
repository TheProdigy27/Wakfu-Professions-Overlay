// API exposée au panneau par le preload (window.api) et canaux IPC autorisés. Types seulement côté renderer.
import type { ChatItemChange } from '../core/chat/chatLine';
import type { DataStatus } from '../core/data/dataStatus';
import type { GameIndexFile } from '../core/data/indexFile';
import type { Locale } from '../core/i18n/locale';
import type { JobLevels } from '../core/jobs/jobCrafts';
import type { Prices } from '../core/needs/cost';
import type { CraftList, RecipePrefs } from '../core/state/craftList';
import type { HotkeyProblem } from '../core/state/hotkey';

export interface WindowState {
  compact: boolean;
  /** Entre 0,3 et 1. */
  opacity: number;
}

/**
 * state.json n'a pas pu être relu et a été mis de côté, sous le nom `file` : illisible ou invalide (corrupt),
 * ou écrit par une version plus récente de l'application (newer).
 */
export interface StoreProblem {
  kind: 'corrupt' | 'newer';
  file: string;
}

/** Réglages et état de l'application, tenus par le processus principal. */
export interface AppState {
  /** Langue de l'interface : celle choisie, ou à défaut celle de Windows. */
  locale: Locale;
  hotkey: {
    accelerator: string;
    /** false : déjà pris par une autre application au démarrage. */
    registered: boolean;
  };
  launchAtLogin: boolean;
  /** Panneau affiché au lancement de Wakfu, masqué à sa fermeture. */
  showWithWakfu: boolean;
  /** Quantités possédées mises à jour avec le chat de Wakfu. */
  ownedFromChat: boolean;
  autoUpdate: boolean;
  hardwareAcceleration: boolean;
  /** Valeur au démarrage : un changement ne prend effet qu'au prochain lancement. */
  hardwareAccelerationActive: boolean;
  onboardingDone: boolean;
  /** Application installée : le lancement avec Windows et les mises à jour ne concernent qu'elle. */
  packaged: boolean;
  version: string;
  /** state.json n'a pas pu être relu au démarrage (fichier mis de côté). */
  storeProblem: StoreProblem | null;
  /** La dernière écriture de state.json a échoué : détail de l'erreur. */
  saveError: string | null;
}

/** Mise à jour de l'application depuis les Releases GitHub (electron-updater). */
export type UpdateStatus =
  /** Hors de la version installée (développement, tests hors réseau). */
  | { state: 'unavailable' }
  /** Pas encore vérifié : mises à jour automatiques désactivées. */
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'latest' }
  | { state: 'downloading'; version: string; percent: number }
  /** Téléchargée : installée à la fermeture de l'application (si les mises à jour automatiques sont actives), ou tout de suite à la demande. */
  | { state: 'ready'; version: string }
  /** Traduite par le panneau : recherche impossible (réseau, GitHub), version en cours de publication, aucune version publiée. */
  | { state: 'error'; reason: 'check' | 'publishing' | 'not-published' }
  | { state: 'error'; reason: 'download'; version: string };

export type BooleanOption = 'launchAtLogin' | 'showWithWakfu' | 'ownedFromChat' | 'autoUpdate' | 'hardwareAcceleration';
export const BOOLEAN_OPTIONS: readonly BooleanOption[] = [
  'launchAtLogin',
  'showWithWakfu',
  'ownedFromChat',
  'autoUpdate',
  'hardwareAcceleration',
];

export interface SavedLists {
  current: CraftList | null;
  history: CraftList[];
  recipePrefs: RecipePrefs;
  jobLevels: JobLevels;
  prices: Prices;
}

/**
 * Nouveau raccourci refusé : combinaison qui gênerait la saisie (HotkeyProblem), accélérateur illisible (invalid),
 * déjà pris par une autre application (taken) ou refusé par Windows (not-global).
 */
export type HotkeyChange = { ok: true } | { ok: false; problem: HotkeyProblem | 'invalid' | 'taken' | 'not-global' };

export interface PanelApi {
  /** Index compact courant, null tant qu'aucune donnée n'est disponible. */
  getIndex(): Promise<GameIndexFile | null>;
  onIndexChanged(listener: () => void): () => void;
  getDataStatus(): Promise<DataStatus>;
  onDataStatus(listener: (status: DataStatus) => void): () => void;
  checkData(): Promise<void>;
  getWindowState(): Promise<WindowState>;
  onWindowState(listener: (state: WindowState) => void): () => void;
  setOpacity(opacity: number): void;
  setCompact(compact: boolean): void;
  hidePanel(): void;

  getApp(): Promise<AppState>;
  onApp(listener: (state: AppState) => void): () => void;
  /** Demande de la zone de notification : ouvrir les réglages. */
  onOpenSettings(listener: () => void): () => void;
  /** Listes, niveaux de métier et prix sauvegardés au dernier lancement. */
  getLists(): Promise<SavedLists>;
  /** Enregistrement : state.json est écrit au plus 300 ms plus tard. */
  saveCurrent(list: CraftList | null): void;
  saveHistory(history: CraftList[]): void;
  saveRecipePrefs(prefs: RecipePrefs): void;
  saveJobLevels(levels: JobLevels): void;
  savePrices(prices: Prices): void;
  /** Objets ramassés ou perdus en jeu, lus dans le chat de Wakfu (réglage ownedFromChat). */
  onChatChanges(listener: (changes: ChatItemChange[]) => void): () => void;
  setHotkey(accelerator: string): Promise<HotkeyChange>;
  /** Pendant la saisie d'un nouveau raccourci, l'actuel est désactivé. */
  suspendHotkey(suspended: boolean): void;
  setOption(name: BooleanOption, value: boolean): void;
  setLanguage(locale: Locale): void;
  completeOnboarding(): void;
  /** Redémarre l'application (accélération matérielle). */
  restart(): void;
  getUpdate(): Promise<UpdateStatus>;
  onUpdate(listener: (status: UpdateStatus) => void): () => void;
  /** Recherche une mise à jour et la télécharge s'il y en a une. */
  checkUpdate(): Promise<void>;
  /** Installe la mise à jour téléchargée et relance l'application. */
  installUpdate(): void;
  openLog(): void;
  openDataFolder(): void;
  copyText(text: string): void;
  /** Écrit dans le journal du processus principal (erreurs du panneau). */
  log(message: string): void;
}

export const IPC = {
  getIndex: 'data:get-index',
  indexChanged: 'data:index-changed',
  getDataStatus: 'data:get-status',
  dataStatus: 'data:status',
  checkData: 'data:check',
  getWindowState: 'window:get-state',
  windowState: 'window:state',
  setOpacity: 'window:set-opacity',
  setCompact: 'window:set-compact',
  hidePanel: 'window:hide',
  getApp: 'app:get-state',
  appState: 'app:state',
  openSettings: 'app:open-settings',
  getLists: 'lists:get',
  saveCurrent: 'lists:save-current',
  saveHistory: 'lists:save-history',
  saveRecipePrefs: 'lists:save-prefs',
  saveJobLevels: 'jobs:save-levels',
  savePrices: 'prices:save',
  chatChanges: 'chat:changes',
  setHotkey: 'settings:set-hotkey',
  suspendHotkey: 'settings:suspend-hotkey',
  setOption: 'settings:set-option',
  setLanguage: 'settings:set-language',
  completeOnboarding: 'settings:onboarding-done',
  restart: 'app:restart',
  getUpdate: 'update:get',
  updateStatus: 'update:status',
  checkUpdate: 'update:check',
  installUpdate: 'update:install',
  openLog: 'app:open-log',
  openDataFolder: 'app:open-data-folder',
  copyText: 'app:copy-text',
  log: 'app:log',
} as const;
