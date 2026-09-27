// state.json : chargement avec migrations et validation, écriture atomique au plus SAVE_DELAY_MS
// après une modification. Sans dépendance à Electron.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { MIGRATIONS, NewerStateError, parseState, stateVersion, type Migration } from '../../core/state/migrations';
import { defaultState, STATE_SCHEMA_VERSION, type PersistedState } from '../../core/state/schema';
import type { StoreProblem } from '../../preload/api';
import { writeFileAtomicSync } from './atomicWrite';

/** Délai maximal entre une modification et son écriture : c'est au plus ce qu'un arrêt forcé peut faire perdre. */
export const SAVE_DELAY_MS = 300;

export interface JsonStoreOptions {
  /** Dossier de l'application (%APPDATA%\<app>). */
  dir: string;
  log?: (message: string) => void;
  delayMs?: number;
  migrations?: Readonly<Record<number, Migration>>;
  now?: () => Date;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export class JsonStore {
  readonly file: string;
  /** state.json n'a pas pu être relu et a été mis de côté (signalé dans le panneau) ; null sinon. */
  readonly loadProblem: StoreProblem | null;
  private state: PersistedState;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private error: string | null = null;
  private readonly errorListeners = new Set<(error: string | null) => void>();
  private readonly log: (message: string) => void;

  /** Lecture synchrone : les réglages (accélération matérielle) doivent être connus avant app.whenReady(). */
  constructor(private readonly options: JsonStoreOptions) {
    this.file = path.join(options.dir, 'state.json');
    this.log = options.log ?? (() => {});
    const { state, problem } = this.read();
    this.state = state;
    this.loadProblem = problem;
  }

  get(): PersistedState {
    return this.state;
  }

  /** Détail de la dernière erreur d'écriture, null si la dernière écriture a réussi. */
  get saveError(): string | null {
    return this.error;
  }

  onSaveError(listener: (error: string | null) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /** Modifie l'état ; l'écriture suit au plus tard SAVE_DELAY_MS après la première modification non écrite. */
  update(change: (state: PersistedState) => PersistedState): void {
    const next = change(this.state);
    if (next === this.state) return;
    this.state = next;
    this.dirty = true;
    this.timer ??= setTimeout(() => this.flush(), this.options.delayMs ?? SAVE_DELAY_MS);
  }

  /** Écrit tout de suite ce qui ne l'est pas encore (fermeture de l'application ou de la session Windows). */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.dirty) return;
    try {
      mkdirSync(this.options.dir, { recursive: true });
      writeFileAtomicSync(this.file, JSON.stringify(this.state, null, 1));
      this.dirty = false;
      this.setError(null);
    } catch (err) {
      // On garde les modifications en mémoire : la prochaine modification ou la fermeture retentera.
      this.log(`state.json : écriture impossible (${errorText(err)})`);
      this.setError(errorText(err));
    }
  }

  private setError(error: string | null): void {
    if (error === this.error) return;
    this.error = error;
    for (const listener of this.errorListeners) listener(error);
  }

  private read(): { state: PersistedState; problem: StoreProblem | null } {
    if (!existsSync(this.file)) return { state: defaultState(), problem: null };
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch (err) {
      return this.setAside(err);
    }
    const version = stateVersion(json);
    try {
      if (version !== null && version < STATE_SCHEMA_VERSION) {
        const backup = this.sibling(`state.v${version}.bak.json`);
        copyFileSync(this.file, backup);
        this.log(`state.json : migration du format ${version} au format ${STATE_SCHEMA_VERSION} (copie : ${path.basename(backup)})`);
      }
      return { state: parseState(json, this.options.migrations ?? MIGRATIONS), problem: null };
    } catch (err) {
      if (err instanceof NewerStateError) {
        // Écrit par une version plus récente de l'application : gardé intact à côté, pour un retour à cette version.
        const backup = this.sibling(`state.v${err.version}.bak.json`);
        copyFileSync(this.file, backup);
        this.log(`${err.message} : copie dans ${path.basename(backup)}, état vierge`);
        return { state: defaultState(), problem: { kind: 'newer', file: path.basename(backup) } };
      }
      return this.setAside(err);
    }
  }

  /** Fichier illisible ou invalide : renommé state.corrupt-{date}.json, et on repart d'un état vierge. */
  private setAside(err: unknown): { state: PersistedState; problem: StoreProblem } {
    const stamp = (this.options.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-');
    const aside = this.sibling(`state.corrupt-${stamp}.json`);
    try {
      renameSync(this.file, aside);
    } catch (renameErr) {
      this.log(`state.json : mise de côté impossible (${errorText(renameErr)})`);
    }
    this.log(`state.json illisible (${errorText(err).split('\n')[0]}) : renommé ${path.basename(aside)}, état vierge`);
    return { state: defaultState(), problem: { kind: 'corrupt', file: path.basename(aside) } };
  }

  private sibling(name: string): string {
    return path.join(path.dirname(this.file), name);
  }
}
