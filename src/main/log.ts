// Journal du processus principal : console et fichier logs/main.log du dossier de l'application.
// On peut y relire après coup les erreurs de données, d'icônes, d'enregistrement ou du panneau (ancien fichier : main.old.log).
import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 1_000_000;

/** Journal courant, ouvert depuis la zone de notification ou les réglages. */
export function logFile(dir: string): string {
  return path.join(dir, 'logs', 'main.log');
}

export function createLogger(dir: string): (message: string) => void {
  const file = logFile(dir);
  // Écritures à la suite, sans jamais bloquer ni faire échouer l'appelant.
  let queue: Promise<unknown> = (async () => {
    await mkdir(path.dirname(file), { recursive: true });
    const size = await stat(file).then((s) => s.size, () => 0);
    if (size > MAX_BYTES) await rename(file, path.join(path.dirname(file), 'main.old.log'));
  })().catch(() => {});
  return (message) => {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);
    queue = queue.then(() => appendFile(file, `${line}\n`)).catch(() => {});
  };
}
