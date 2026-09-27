// Données du jeu : version, téléchargement, construction et cache de l'index.
// Sans dépendance à Electron : le dossier de données et fetch sont injectés.
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { buildIndex, DataBuildError, type MinCounts } from '../../core/data/buildIndex';
import type { DataErrorCode, DataStatus } from '../../core/data/dataStatus';
import { parseIndexFile, readIndexHeader, type GameIndexFile } from '../../core/data/indexFile';
import {
  DataFormatError,
  parseConfig,
  parseItemsFallback,
  parseRawFile,
  RAW_FILE_NAMES,
  type RawGamedata,
  type RawItem,
} from '../../core/data/rawSchemas';
import { writeFileAtomic } from '../store/atomicWrite';

export const DEFAULT_CDN = 'https://wakfu.cdn.ankama.com/gamedata';
const SIX_HOURS = 6 * 3600 * 1000;

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export type { DataErrorCode, DataStatus };

export interface GamedataServiceOptions {
  /** Dossier de l'application (%APPDATA%\<app>) : les données vont dans son sous-dossier data\. */
  dir: string;
  fetch?: FetchLike;
  cdn?: string;
  now?: () => number;
  log?: (message: string) => void;
  minCounts?: MinCounts;
  configTimeoutMs?: number;
  fileTimeoutMs?: number;
  /** Délai après lequel checkIfStale() revérifie la version (6 h). */
  staleAfterMs?: number;
}

// ---------------------------------------------------------------- Fichiers bruts

/**
 * Taille habituelle des fichiers (1.93.1.62), pour la progression du téléchargement : le CDN les envoie compressés,
 * sans en annoncer la taille. Un fichier en cours n'atteint jamais sa part entière avant d'être complet.
 */
export const RAW_FILE_BYTES: Readonly<Record<string, number>> = {
  recipes: 503_000,
  recipeIngredients: 2_260_079,
  recipeResults: 461_295,
  recipeCategories: 2_581,
  jobsItems: 6_054_058,
  itemTypes: 21_146,
};

export interface DownloadOptions {
  fetch: FetchLike;
  cdn: string;
  timeoutMs: number;
  /** Nombre de fichiers terminés, et part du téléchargement déjà reçue, de 0 à 1. */
  onProgress?: (done: number, total: number, fraction: number) => void;
}

async function readBody(res: Response, onBytes: (received: number) => void): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onBytes(received);
  }
  return Buffer.concat(chunks, received);
}

/** Télécharge les fichiers absents de rawDir. Un fichier n'apparaît qu'une fois complet : un téléchargement interrompu reprend où il s'était arrêté. */
export async function downloadRawFiles(
  rawDir: string,
  version: string,
  names: readonly string[],
  options: DownloadOptions,
): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  const weights = names.map((name) => RAW_FILE_BYTES[name] ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let done = 0;
  let completeWeight = 0;
  const report = (partial: number) => options.onProgress?.(done, names.length, (completeWeight + partial) / totalWeight);
  for (const [i, name] of names.entries()) {
    const file = path.join(rawDir, `${name}.json`);
    const weight = weights[i]!;
    if (!existsSync(file)) {
      const res = await options.fetch(`${options.cdn}/${version}/${name}.json`, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!res.ok) throw new Error(`${name}.json : HTTP ${res.status}`);
      const body = await readBody(res, (received) => report(Math.min(received, weight * 0.99)));
      await writeFileAtomic(file, body);
    }
    done++;
    completeWeight += weight;
    report(0);
  }
}

async function readJson(file: string): Promise<unknown> {
  const text = await readFile(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new DataFormatError(path.basename(file), 'JSON invalide');
  }
}

/** Lit et valide les 6 fichiers bruts ; lève DataFormatError au premier fichier inattendu. */
export async function readRawGamedata(rawDir: string): Promise<RawGamedata> {
  const out: Partial<RawGamedata> = {};
  for (const name of RAW_FILE_NAMES) {
    const json = await readJson(path.join(rawDir, `${name}.json`));
    Object.assign(out, { [name]: parseRawFile(name, json) });
  }
  return out as RawGamedata;
}

export async function readItemsFallback(rawDir: string): Promise<RawItem[]> {
  return parseItemsFallback(await readJson(path.join(rawDir, 'items.json')));
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

// ---------------------------------------------------------------- Service

export class GamedataService {
  private file: GameIndexFile | null = null;
  private state: DataStatus = { version: null, offline: false, busy: null, error: null, lastCheckAt: null };
  private running: Promise<void> | null = null;
  private readonly statusListeners = new Set<(status: DataStatus) => void>();
  private readonly indexListeners = new Set<(file: GameIndexFile, previousVersion: string | null) => void>();

  private readonly fetch: FetchLike;
  private readonly cdn: string;
  private readonly now: () => number;
  private readonly log: (message: string) => void;
  private readonly dataDir: string;

  constructor(private readonly options: GamedataServiceOptions) {
    this.fetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.cdn = options.cdn ?? DEFAULT_CDN;
    this.now = options.now ?? Date.now;
    this.log = options.log ?? (() => {});
    this.dataDir = path.join(options.dir, 'data');
  }

  get status(): DataStatus {
    return this.state;
  }

  /** Index compact courant, null tant qu'aucune donnée n'est disponible. */
  get indexFile(): GameIndexFile | null {
    return this.file;
  }

  onStatus(listener: (status: DataStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Appelé à chaque nouvel index (chargement du cache, nouvelle version, reconstruction). */
  onIndex(listener: (file: GameIndexFile, previousVersion: string | null) => void): () => void {
    this.indexListeners.add(listener);
    return () => this.indexListeners.delete(listener);
  }

  private get indexPath(): string {
    return path.join(this.dataDir, 'index.json');
  }

  private rawDir(version: string): string {
    return path.join(this.dataDir, 'raw', version);
  }

  /**
   * Démarrage, sans réseau : charge data/index.json. S'il est illisible ou d'un format d'index périmé
   * (nouvelle version de l'application), il est reconstruit à partir de data/raw/{v}/.
   */
  async loadCache(): Promise<void> {
    let json: unknown;
    try {
      json = await readJson(this.indexPath);
    } catch {
      json = undefined;
    }
    let file: GameIndexFile | null = null;
    try {
      if (json !== undefined) file = parseIndexFile(json);
    } catch {
      this.log('index.json illisible ou d\'un format périmé : reconstruction depuis les fichiers bruts');
    }
    if (!file) {
      const header = readIndexHeader(json).gameVersion;
      const version = typeof header === 'string' ? header : await this.newestRawVersion();
      if (version) {
        try {
          file = await this.buildFromRaw(version, { network: false, keepPrevious: false });
        } catch (err) {
          this.log(`reconstruction de ${version} impossible : ${errorText(err)}`);
        }
      }
    }
    if (file) this.setIndex(file);
  }

  /** Vérifie la version publiée et installe les nouvelles données si besoin. Un seul appel à la fois. */
  check(): Promise<void> {
    this.running ??= this.runCheck().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** À l'affichage du panneau : ne revérifie que si la dernière vérification date de plus de 6 h. */
  checkIfStale(): Promise<void> {
    const last = this.state.lastCheckAt;
    if (last !== null && this.now() - last < (this.options.staleAfterMs ?? SIX_HOURS)) return Promise.resolve();
    return this.check();
  }

  private async runCheck(): Promise<void> {
    let version: string;
    try {
      const res = await this.fetch(`${this.cdn}/config.json`, {
        signal: AbortSignal.timeout(this.options.configTimeoutMs ?? 5000),
      });
      if (!res.ok) throw new Error(`config.json : HTTP ${res.status}`);
      version = parseConfig(await res.json());
    } catch (err) {
      if (err instanceof DataFormatError) {
        this.fail('format', err, null);
        return;
      }
      this.log(`vérification de version impossible : ${errorText(err)}`);
      this.update({
        offline: true,
        lastCheckAt: this.now(),
        error: this.file
          ? null
          : {
              code: 'offline-no-data',
              message: 'Connexion requise au premier lancement : les données du jeu n\'ont pas encore été téléchargées.',
            },
      });
      return;
    }

    if (this.file?.gameVersion === version) {
      this.update({ offline: false, error: null, lastCheckAt: this.now() });
      return;
    }

    try {
      const total = RAW_FILE_NAMES.length;
      let shown = { done: 0, percent: 0 };
      this.update({ offline: false, busy: { step: 'download', version, total, ...shown } });
      await downloadRawFiles(this.rawDir(version), version, RAW_FILE_NAMES, {
        fetch: this.fetch,
        cdn: this.cdn,
        timeoutMs: this.options.fileTimeoutMs ?? 120_000,
        onProgress: (done, _total, fraction) => {
          // Un état par pourcent gagné ou par fichier terminé, pas un par bloc reçu.
          const percent = Math.floor(fraction * 100);
          if (done === shown.done && percent === shown.percent) return;
          shown = { done, percent };
          this.update({ busy: { step: 'download', version, total, ...shown } });
        },
      });
      this.update({ busy: { step: 'build', version } });
      const file = await this.buildFromRaw(version, { network: true, keepPrevious: true });
      this.setIndex(file);
      this.update({ busy: null, error: null, lastCheckAt: this.now() });
      await this.removeRawExcept(version);
    } catch (err) {
      const format = err instanceof DataFormatError || err instanceof DataBuildError;
      // Des fichiers au format inattendu ne serviront pas : on les retélécharge à la prochaine vérification.
      if (format) await rm(this.rawDir(version), { recursive: true, force: true });
      this.fail(format ? 'format' : 'network', err, version);
    }
  }

  private fail(code: 'format' | 'network', err: unknown, version: string | null): void {
    this.log(`données ${version ?? ''} : ${errorText(err)}`);
    const kept = this.file ? ` Les données ${this.file.gameVersion} restent utilisées.` : '';
    const message =
      code === 'format'
        ? `Les données du jeu${version ? ` ${version}` : ''} ont un format que cette version de l'application ne sait pas lire : mettez à jour l'application.${kept}`
        : `Téléchargement des données ${version} interrompu, nouvel essai plus tard.${kept}`;
    this.update({ busy: null, error: { code, message }, lastCheckAt: this.now() });
  }

  private async buildFromRaw(
    version: string,
    options: { network: boolean; keepPrevious: boolean },
  ): Promise<GameIndexFile> {
    const rawDir = this.rawDir(version);
    const raw = await readRawGamedata(rawDir);
    const minCounts = this.options.minCounts;
    let itemsFallback = existsSync(path.join(rawDir, 'items.json')) ? await readItemsFallback(rawDir) : undefined;
    let built = buildIndex(version, raw, { minCounts, itemsFallback });
    if (built.report.missingItemIds.length && !itemsFallback && options.network) {
      this.log(`${built.report.missingItemIds.length} id(s) absents de jobsItems.json : téléchargement de items.json`);
      await downloadRawFiles(rawDir, version, ['items'], {
        fetch: this.fetch,
        cdn: this.cdn,
        timeoutMs: this.options.fileTimeoutMs ?? 120_000,
      });
      itemsFallback = await readItemsFallback(rawDir);
      built = buildIndex(version, raw, { minCounts, itemsFallback });
    }
    if (built.report.missingItemIds.length) {
      this.log(`${built.report.missingItemIds.length} id(s) non résolu(s), affichés comme « Objet inconnu »`);
    }
    await mkdir(this.dataDir, { recursive: true });
    if (options.keepPrevious && existsSync(this.indexPath)) {
      await copyFile(this.indexPath, path.join(this.dataDir, 'index.prev.json'));
    }
    await writeFileAtomic(this.indexPath, JSON.stringify(built.file));
    return built.file;
  }

  private async rawVersions(): Promise<string[]> {
    const dir = path.join(this.dataDir, 'raw');
    if (!existsSync(dir)) return [];
    return (await readdir(dir)).filter((d) => /^\d+(\.\d+)+$/.test(d)).sort(compareVersions);
  }

  private async newestRawVersion(): Promise<string | undefined> {
    return (await this.rawVersions()).at(-1);
  }

  /** Seuls les fichiers bruts de la version courante sont conservés. */
  private async removeRawExcept(version: string): Promise<void> {
    for (const v of await this.rawVersions()) {
      if (v !== version) await rm(this.rawDir(v), { recursive: true, force: true });
    }
  }

  private setIndex(file: GameIndexFile): void {
    const previous = this.file?.gameVersion ?? null;
    this.file = file;
    this.update({ version: file.gameVersion });
    for (const listener of this.indexListeners) listener(file, previous);
  }

  private update(patch: Partial<DataStatus>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.statusListeners) listener(this.state);
  }
}
