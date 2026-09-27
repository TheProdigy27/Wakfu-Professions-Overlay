// Lancement et fermeture de Wakfu, pour le réglage « Afficher le panneau au lancement de Wakfu ».
// Le jeu tourne dans le Java qu'il embarque (javaw.exe, comme d'autres jeux Java) : on le reconnaît au titre de sa
// fenêtre, « WAKFU » ou « <personnage> - WAKFU ». tasklist, filtré sur javaw.exe, répond en 40 ms environ.
import { execFile } from 'node:child_process';

export const POLL_MS = 5000;

/** Sortie CSV de `tasklist /v` : une fenêtre de Wakfu parmi les processus listés ? Le titre est la dernière colonne. */
export function hasWakfuWindow(csv: string): boolean {
  return csv.split(/\r?\n/).some((line) => {
    const title = /"((?:[^"]|"")*)"\s*$/.exec(line)?.[1];
    return title !== undefined && /\bWAKFU\b/.test(title);
  });
}

/** Processus javaw.exe et titres de leurs fenêtres. Sans processus, tasklist écrit une phrase d'information. */
function listJava(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'tasklist',
      ['/fi', 'imagename eq javaw.exe', '/v', '/fo', 'csv', '/nh'],
      { windowsHide: true, timeout: 10_000 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
}

export interface WakfuWatcherOptions {
  onStart: () => void;
  onStop: () => void;
  log: (message: string) => void;
  /** Tests : remplace tasklist. */
  list?: () => Promise<string>;
  pollMs?: number;
}

export class WakfuWatcher {
  private enabled = false;
  /** Change à chaque activation : une vérification lancée avant ne compte plus. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  /** Échec de tasklist déjà écrit dans le journal : pas une ligne toutes les 5 s. */
  private failing = false;

  constructor(private readonly options: WakfuWatcherOptions) {}

  /** Activé, un jeu déjà lancé compte comme un lancement. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    if (enabled) void this.poll(this.generation);
  }

  private async poll(generation: number): Promise<void> {
    // tasklist en échec : l'état ne change pas, le panneau n'est ni affiché ni masqué.
    let running = this.running;
    try {
      running = hasWakfuWindow(await (this.options.list ?? listJava)());
      this.failing = false;
    } catch (err) {
      if (!this.failing) this.options.log(`détection de Wakfu impossible : ${err instanceof Error ? err.message : String(err)}`);
      this.failing = true;
    }
    if (generation !== this.generation) return;
    this.timer = setTimeout(() => void this.poll(generation), this.options.pollMs ?? POLL_MS);
    if (running === this.running) return;
    this.running = running;
    if (running) this.options.onStart();
    else this.options.onStop();
  }
}
