// Données Ankama réelles, version figée (celle des valeurs attendues des tests), téléchargées une fois dans .cache/.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, type BuildReport } from '../../src/core/data/buildIndex';
import type { GameIndexFile } from '../../src/core/data/indexFile';
import { loadIndex, type GameIndex } from '../../src/core/data/loadIndex';
import { RAW_FILE_NAMES } from '../../src/core/data/rawSchemas';
import { DEFAULT_CDN, downloadRawFiles, readRawGamedata } from '../../src/main/data/gamedataService';

export const REAL_DATA_VERSION = '1.93.1.62';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function realRawDir(version = REAL_DATA_VERSION): string {
  return path.join(root, '.cache', 'gamedata', version);
}

export async function ensureRealRaw(names: readonly string[] = RAW_FILE_NAMES, version = REAL_DATA_VERSION): Promise<string> {
  const dir = realRawDir(version);
  await downloadRawFiles(dir, version, names, {
    fetch: (url, init) => fetch(url, init),
    cdn: DEFAULT_CDN,
    timeoutMs: 300_000,
  });
  return dir;
}

export interface RealIndex {
  file: GameIndexFile;
  index: GameIndex;
  report: BuildReport;
  /** Durée de buildIndex seule (fichiers déjà lus et validés). */
  buildMs: number;
  /** Durée de lecture + validation zod des 6 fichiers bruts. */
  readMs: number;
}

let cached: Promise<RealIndex> | undefined;

export function buildRealIndex(): Promise<RealIndex> {
  cached ??= (async () => {
    const dir = await ensureRealRaw();
    const t0 = performance.now();
    const raw = await readRawGamedata(dir);
    const t1 = performance.now();
    const { file, report } = buildIndex(REAL_DATA_VERSION, raw);
    const t2 = performance.now();
    return { file, index: loadIndex(file, 'fr'), report, readMs: t1 - t0, buildMs: t2 - t1 };
  })();
  return cached;
}
