// Suivi du chat de Wakfu pour le réglage « Mettre à jour les quantités avec le chat de Wakfu » : objets ramassés ou
// perdus, crafts réussis. Le jeu écrit son chat dans %APPDATA%\zaap\gamesLogs\wakfu\logs\wakfu_chat.log (log4j, UTF-8) ;
// vers 1 Mo, le fichier est renommé en wakfu_chat.log.1 et un nouveau commence. Seules les lignes écrites après
// l'activation comptent. Le fichier est ouvert le temps d'une lecture, une fois par seconde, sans jamais gêner le jeu qui
// l'écrit.
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { ChatReader, type ChatEvent } from '../core/chat/chatLine';

export const CHAT_POLL_MS = 1000;
/** Au-delà, le début de ce qui a été écrit depuis la dernière lecture est sauté. */
const MAX_READ = 4 * 2 ** 20;
const NEWLINE = 0x0a;

export function chatLogPath(appData: string): string {
  return path.join(appData, 'zaap', 'gamesLogs', 'wakfu', 'logs', 'wakfu_chat.log');
}

/** Taille du fichier ; null s'il n'existe pas. */
async function fileSize(file: string): Promise<number | null> {
  try {
    return (await stat(file)).size;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function readRange(file: string, start: number, end: number): Promise<Buffer> {
  const from = Math.max(start, end - MAX_READ);
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(end - from);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, from);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export interface ChatWatcherOptions {
  file: string;
  /** Objets ramassés ou perdus et crafts réussis, dans l'ordre du chat. */
  onEvents: (events: ChatEvent[]) => void;
  log: (message: string) => void;
  pollMs?: number;
}

export class ChatWatcher {
  private enabled = false;
  /** Change à chaque activation : une lecture lancée avant ne compte plus. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Octets déjà lus du fichier ; null : à l'activation, on part de sa fin. */
  private offset: number | null = null;
  /** Début d'une ligne pas encore terminée. */
  private partial = Buffer.alloc(0);
  /** Garde les lignes d'objets d'un craft dont l'annonce n'est pas encore écrite. */
  private reader = new ChatReader();
  /** Lectures à la suite, jamais en même temps. */
  private queue: Promise<void> = Promise.resolve();
  /** Fichier absent ou illisible déjà écrit dans le journal : pas une ligne par seconde. */
  private problem: string | null = null;

  constructor(private readonly options: ChatWatcherOptions) {}

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.offset = null;
    this.partial = Buffer.alloc(0);
    this.reader = new ChatReader();
    this.problem = null;
    this.options.log(`chat de Wakfu : suivi ${enabled ? 'activé' : 'désactivé'}`);
    if (enabled) void this.poll(this.generation);
  }

  /** Lit ce qui a été écrit depuis la dernière lecture (appelé chaque seconde ; tests). */
  check(): Promise<void> {
    const generation = this.generation;
    this.queue = this.queue.then(async () => {
      if (!this.enabled || generation !== this.generation) return;
      let problem: string | null;
      try {
        problem = await this.read();
      } catch (err) {
        problem = `lecture impossible : ${err instanceof Error ? err.message : String(err)}`;
      }
      if (problem === this.problem) return;
      this.options.log(`chat de Wakfu : ${problem ?? 'lecture reprise'}`);
      this.problem = problem;
    });
    return this.queue;
  }

  private async poll(generation: number): Promise<void> {
    await this.check();
    if (generation !== this.generation) return;
    this.timer = setTimeout(() => void this.poll(generation), this.options.pollMs ?? CHAT_POLL_MS);
  }

  /** Problème à écrire dans le journal, ou null. */
  private async read(): Promise<string | null> {
    const { file } = this.options;
    const size = await fileSize(file);
    if (size === null) {
      // Pas encore de chat : tout ce que le jeu y écrira comptera.
      this.offset = 0;
      this.partial = Buffer.alloc(0);
      return `${file} introuvable`;
    }
    if (this.offset === null) {
      this.offset = size;
      return null;
    }
    const chunks: Buffer[] = [];
    if (size < this.offset) {
      // Renommé en .1 depuis la dernière lecture : sa fin, puis le nouveau fichier depuis le début.
      const previous = `${file}.1`;
      const previousSize = await fileSize(previous);
      if (previousSize !== null && previousSize > this.offset) chunks.push(await readRange(previous, this.offset, previousSize));
      else this.partial = Buffer.alloc(0);
      this.offset = 0;
    }
    if (size > this.offset) chunks.push(await readRange(file, this.offset, size));
    this.offset = size;
    if (chunks.length) this.parse(Buffer.concat([this.partial, ...chunks]));
    return null;
  }

  private parse(buffer: Buffer): void {
    const events: ChatEvent[] = [];
    let start = 0;
    for (let end = buffer.indexOf(NEWLINE); end !== -1; end = buffer.indexOf(NEWLINE, start)) {
      const event = this.reader.read(buffer.toString('utf8', start, end).replace(/\r$/, ''));
      if (event) events.push(event);
      start = end + 1;
    }
    this.partial = Buffer.from(buffer.subarray(start));
    if (events.length) this.options.onEvents(events);
  }
}
