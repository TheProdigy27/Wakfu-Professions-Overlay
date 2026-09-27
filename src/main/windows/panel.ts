// Panneau au premier plan : affiché sans prendre le focus, pour que le jeu garde le clavier.
import { BrowserWindow, screen, type Rectangle } from 'electron';
import { MIN_OPACITY } from '../../core/state/schema';
import type { WindowState } from '../../preload/api';
import { defaultBounds, isReachable, placeWindow } from './placement';

export type Mode = 'normal' | 'compact';
/** Position et taille mémorisées par mode. */
export type SavedBounds = Partial<Record<Mode, Rectangle>>;

const SIZES: Record<Mode, { width: number; height: number; minWidth: number; minHeight: number }> = {
  normal: { width: 420, height: 640, minWidth: 320, minHeight: 280 },
  compact: { width: 300, height: 240, minWidth: 220, minHeight: 140 },
};

export interface PanelOptions {
  preload: string;
  /** Icône de la fenêtre (Alt+Tab). */
  icon: string;
  /** Charge la page du panneau (serveur de développement ou fichier du build). */
  load: (win: BrowserWindow) => Promise<void>;
  log?: (message: string) => void;
  /** État mémorisé au dernier lancement. */
  initial?: { state: WindowState; bounds: SavedBounds };
  /** Fermeture de la session Windows (arrêt, redémarrage) : dernière occasion d'écrire l'état. */
  onSessionEnd?: () => void;
}

const workAreas = () => screen.getAllDisplays().map((d) => d.workArea);

export class PanelWindow {
  private win: BrowserWindow | null = null;
  private current: WindowState;
  private readonly bounds: SavedBounds;
  private readonly listeners = new Set<(state: WindowState) => void>();
  private readonly boundsListeners = new Set<(bounds: SavedBounds) => void>();
  private readonly showListeners = new Set<() => void>();
  private quitting = false;

  /** À créer après app.whenReady() (écrans). */
  constructor(private readonly options: PanelOptions) {
    this.current = options.initial?.state ?? { compact: false, opacity: 0.95 };
    this.bounds = { ...options.initial?.bounds };
    // Écran débranché, résolution ou mise à l'échelle changée : le panneau revient sur l'écran principal s'il en est sorti.
    screen.on('display-removed', () => this.ensureVisible());
    screen.on('display-metrics-changed', () => this.ensureVisible());
  }

  get state(): WindowState {
    return this.current;
  }

  get webContents(): Electron.WebContents | undefined {
    return this.win?.webContents;
  }

  onState(listener: (state: WindowState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Après un déplacement, un redimensionnement ou un changement de mode. */
  onBounds(listener: (bounds: SavedBounds) => void): () => void {
    this.boundsListeners.add(listener);
    return () => this.boundsListeners.delete(listener);
  }

  onShow(listener: () => void): () => void {
    this.showListeners.add(listener);
    return () => this.showListeners.delete(listener);
  }

  create(): void {
    const mode = this.mode;
    const size = SIZES[mode];
    const win = new BrowserWindow({
      ...this.placement(mode, this.bounds[mode]),
      minWidth: size.minWidth,
      minHeight: size.minHeight,
      title: 'Wakfu Professions Overlay',
      icon: this.options.icon,
      frame: false,
      transparent: false,
      resizable: true,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#16181d',
      webPreferences: {
        preload: this.options.preload,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: true,
        spellcheck: false,
      },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setOpacity(this.current.opacity);
    // La croix et Alt+F4 masquent le panneau ; l'application reste dans la zone de notification.
    win.on('close', (event) => {
      if (this.quitting) return;
      event.preventDefault();
      win.hide();
    });
    win.on('closed', () => {
      this.win = null;
    });
    // move et resize (et non moved / resized) : émis aussi pour un déplacement par le code ou par Windows.
    // Pendant un glissement, state.json n'est de toute façon écrit qu'une fois par SAVE_DELAY_MS.
    win.on('move', () => this.saveBounds());
    win.on('resize', () => this.saveBounds());
    win.on('session-end', () => this.options.onSessionEnd?.());
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.webContents.on('render-process-gone', (_event, details) => {
      this.options.log?.(`panneau : processus de rendu arrêté (${details.reason}), rechargement`);
      if (!this.quitting) this.load(win);
    });
    this.win = win;
    this.load(win);
  }

  get visible(): boolean {
    return !!this.win?.isVisible();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  /** Affiche sans activer : le jeu garde le focus clavier. */
  show(): void {
    if (!this.win) this.create();
    const win = this.win!;
    win.setAlwaysOnTop(true, 'screen-saver');
    win.showInactive();
    win.moveTop();
    for (const listener of this.showListeners) listener();
  }

  hide(): void {
    this.win?.hide();
  }

  setOpacity(opacity: number): void {
    if (!Number.isFinite(opacity)) return;
    const value = Math.round(Math.min(1, Math.max(MIN_OPACITY, opacity)) * 100) / 100;
    if (value === this.current.opacity) return;
    this.win?.setOpacity(value);
    this.update({ opacity: value });
  }

  setCompact(compact: boolean): void {
    if (compact === this.current.compact) return;
    const from = this.mode;
    const to: Mode = compact ? 'compact' : 'normal';
    const win = this.win;
    const previous = win?.getBounds();
    if (previous) this.bounds[from] = previous;
    // Le mode change avant le redimensionnement : ses événements concernent déjà le nouveau mode.
    this.update({ compact });
    if (win && previous) {
      // Sans position mémorisée, le panneau garde son coin supérieur droit.
      const size = SIZES[to];
      const next = this.bounds[to] ?? {
        x: previous.x + previous.width - size.width,
        y: previous.y,
        width: size.width,
        height: size.height,
      };
      win.setMinimumSize(size.minWidth, size.minHeight);
      win.setBounds(this.placement(to, next));
    }
    this.saveBounds();
  }

  /** Replace le panneau sur l'écran principal si on ne peut plus l'attraper. */
  ensureVisible(): void {
    const win = this.win;
    if (!win) return;
    const bounds = win.getBounds();
    if (isReachable(bounds, workAreas())) return;
    this.options.log?.(`panneau hors des écrans (${JSON.stringify(bounds)}) : replacé sur l'écran principal`);
    win.setBounds(defaultBounds(bounds, screen.getPrimaryDisplay().workArea));
    this.saveBounds();
  }

  send(channel: string, ...args: unknown[]): void {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, ...args);
  }

  /** À appeler sur before-quit : la fermeture n'est plus interceptée. */
  prepareQuit(): void {
    this.quitting = true;
  }

  /** Un chargement interrompu (rechargement, fermeture) ne doit pas finir en rejet non géré. */
  private load(win: BrowserWindow): void {
    this.options.load(win).catch((err: unknown) => {
      this.options.log?.(`panneau : chargement impossible (${err instanceof Error ? err.message : String(err)})`);
    });
  }

  private get mode(): Mode {
    return this.current.compact ? 'compact' : 'normal';
  }

  private placement(mode: Mode, saved: Rectangle | undefined): Rectangle {
    return placeWindow(saved, SIZES[mode], workAreas(), screen.getPrimaryDisplay().workArea);
  }

  private saveBounds(): void {
    if (!this.win || this.win.isDestroyed()) return;
    this.bounds[this.mode] = this.win.getBounds();
    for (const listener of this.boundsListeners) listener({ ...this.bounds });
  }

  private update(patch: Partial<WindowState>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener(this.current);
  }
}
