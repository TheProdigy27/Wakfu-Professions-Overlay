import { renameSync, writeFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

const isRetryable = (err: unknown) => RETRYABLE.has((err as NodeJS.ErrnoException).code ?? '');

/** Sous Windows, un antivirus ou l'indexeur peut verrouiller brièvement le fichier cible d'un renommage. */
export async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      if (i >= attempts || !isRetryable(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 20 * i));
    }
  }
}

/** Écrit dans un fichier temporaire puis le renomme : le fichier n'est jamais lu à moitié écrit. */
export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, data);
  await renameWithRetry(tmp, file);
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Version synchrone, pour un petit fichier réécrit souvent (state.json) : deux écritures ne peuvent pas s'entremêler,
 * et elle peut servir à la fermeture de session Windows, quand le processus n'a plus le temps d'attendre.
 */
export function writeFileAtomicSync(file: string, data: string, attempts = 5): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, data);
  for (let i = 1; ; i++) {
    try {
      renameSync(tmp, file);
      return;
    } catch (err) {
      if (i >= attempts || !isRetryable(err)) throw err;
      sleepSync(20 * i);
    }
  }
}
