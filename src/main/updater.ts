// Mises à jour de l'application : electron-updater, depuis les Releases GitHub.
// Vérification au démarrage, puis à l'affichage du panneau si la dernière date de plus de 6 h (aucun minuteur) ;
// téléchargement en arrière-plan, installation à la fermeture de l'application ou tout de suite à la demande.
// Réglage désactivé : aucune vérification automatique, ni installation à la fermeture ; la recherche manuelle reste possible.
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from '../preload/api';

const SIX_HOURS = 6 * 3600 * 1000;
const NOT_PUBLISHED = ['ERR_UPDATER_NO_PUBLISHED_VERSIONS', 'HTTP_ERROR_404'];
/** Étiquette déjà poussée, mais Release encore en construction : latest.yml n'y est pas encore (2 min environ). */
const BEING_PUBLISHED = 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND';

/**
 * Première ligne d'un message d'electron-updater, et l'URL en cause s'il y en a une : ses erreurs HTTP recopient
 * la pile, les en-têtes et les cookies de la réponse, inutiles dans un journal que l'on peut être amené à partager.
 */
export function summary(message: unknown): string {
  const text = String(message);
  const url = /url: (https?:\/\/[^\s"\\]+)/.exec(text)?.[1];
  const first = text.split('\n', 1)[0]!.trim();
  return url && !first.includes(url) ? `${first} (${url})` : first;
}

export interface UpdaterOptions {
  /** Version installée, réseau autorisé : sinon rien n'est jamais vérifié. */
  available: boolean;
  /** Réglage « Installer automatiquement les mises à jour ». */
  enabled: boolean;
  log: (message: string) => void;
}

export class Updater {
  private current: UpdateStatus;
  private enabled: boolean;
  private lastCheckAt: number | null = null;
  private readonly listeners = new Set<(status: UpdateStatus) => void>();

  constructor(private readonly options: UpdaterOptions) {
    this.enabled = options.enabled;
    this.current = options.available ? { state: 'idle' } : { state: 'unavailable' };
    if (!options.available) return;

    const { autoUpdater } = electronUpdater;
    const log = (message: unknown) => options.log(`mise à jour : ${summary(message)}`);
    autoUpdater.logger = { info: log, warn: log, error: log };
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = this.enabled;
    // Installeur complet (NSIS), pas d'installeur web.
    autoUpdater.disableWebInstaller = true;
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }));
    autoUpdater.on('update-not-available', () => this.set({ state: 'latest' }));
    autoUpdater.on('update-available', (info) => this.set({ state: 'downloading', version: info.version, percent: 0 }));
    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.floor(progress.percent);
      if (this.current.state === 'downloading' && percent !== this.current.percent) this.set({ ...this.current, percent });
    });
    autoUpdater.on('update-downloaded', (info) => this.set({ state: 'ready', version: info.version }));
    autoUpdater.on('error', (error: Error & { code?: string }) => {
      // Détail déjà écrit dans le journal par le logger ci-dessus.
      let message = 'Recherche de mise à jour impossible : réseau indisponible ou GitHub injoignable.';
      if (this.current.state === 'downloading') message = `Téléchargement de la version ${this.current.version} interrompu.`;
      else if (error.code === BEING_PUBLISHED) {
        message = 'Une nouvelle version est en cours de publication : réessayez dans quelques minutes.';
      }
      // Dépôt sans version publiée, ou inaccessible (privé, renommé).
      else if (NOT_PUBLISHED.includes(error.code ?? '') || /HttpError: 404\b/.test(String(error.message))) {
        message = 'Aucune version publiée n\'a été trouvée sur GitHub.';
      }
      this.set({ state: 'error', message });
    });
  }

  get status(): UpdateStatus {
    return this.current;
  }

  onChange(listener: (status: UpdateStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Au démarrage. */
  start(): void {
    if (this.enabled) void this.check();
  }

  /** À l'affichage du panneau : ne revérifie que si la dernière vérification date de plus de 6 h. */
  checkIfStale(): void {
    if (this.enabled && (this.lastCheckAt === null || Date.now() - this.lastCheckAt >= SIX_HOURS)) void this.check();
  }

  /** Recherche une mise à jour et la télécharge. Sans effet pendant une recherche, un téléchargement, ou si une mise à jour attend. */
  async check(): Promise<void> {
    if (['unavailable', 'checking', 'downloading', 'ready'].includes(this.current.state)) return;
    this.lastCheckAt = Date.now();
    try {
      const result = await electronUpdater.autoUpdater.checkForUpdates();
      // Échec du téléchargement : signalé par l'événement « error ».
      result?.downloadPromise?.catch(() => {});
    } catch {
      // Signalé par l'événement « error ».
    }
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (this.current.state === 'unavailable') return;
    electronUpdater.autoUpdater.autoInstallOnAppQuit = enabled;
    if (enabled) void this.check();
  }

  /** Installe la mise à jour téléchargée sans fenêtre d'installation, puis relance l'application. */
  install(): void {
    if (this.current.state !== 'ready') return;
    this.options.log(`installation de la version ${this.current.version}`);
    electronUpdater.autoUpdater.quitAndInstall(true, true);
  }

  private set(status: UpdateStatus): void {
    this.current = status;
    for (const listener of this.listeners) listener(status);
  }
}
