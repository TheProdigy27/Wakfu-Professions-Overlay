import { appendFile, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatEvent } from '../../../src/core/chat/chatLine';
import { ChatWatcher, chatLogPath } from '../../../src/main/chatLog';

const loot = (qty: number, name: string) => `21:53:17,445 - [Information (jeu)] Vous avez ramassé ${qty}x ${name} .\r\n`;
const drop = (qty: number, name: string) => `21:53:17,445 - [Information (jeu)] Vous avez perdu ${qty}x ${name} .\r\n`;
const crafted = (name: string) => `21:53:17,446 - [Information (jeu)] Vous avez réussi votre recette de ${name}.\r\n`;
const OTHER = '21:53:20,915 - [Information (combat)] Combat terminé, cliquez ici pour rouvrir l\'écran de fin de combat. \r\n';

let dir: string;
let file: string;
let watcher: ChatWatcher | null = null;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'chat-'));
  file = path.join(dir, 'wakfu_chat.log');
});
afterEach(async () => {
  watcher?.setEnabled(false);
  watcher = null;
  await rm(dir, { recursive: true, force: true });
});

/** Suivi activé ; les lectures sont lancées à la main (check), le minuteur ne se déclenche pas pendant le test. */
async function start() {
  const onEvents = vi.fn<(events: ChatEvent[]) => void>();
  const log = vi.fn<(message: string) => void>();
  watcher = new ChatWatcher({ file, onEvents, log, pollMs: 3_600_000 });
  watcher.setEnabled(true);
  await watcher.check();
  const received = () =>
    onEvents.mock.calls.flatMap(([events]) =>
      events.map((e) =>
        e.kind === 'item' ? `${e.qty} ${e.name}` : `${e.name} crafté : ${e.items.map((i) => `${i.qty} ${i.name}`).join(', ')}`,
      ),
    );
  return { watcher, onEvents, log, received };
}

describe('ChatWatcher', () => {
  it('chemin du chat écrit par le jeu', () => {
    expect(chatLogPath('C:\\Users\\joueur\\AppData\\Roaming')).toBe(
      path.join('C:\\Users\\joueur\\AppData\\Roaming', 'zaap', 'gamesLogs', 'wakfu', 'logs', 'wakfu_chat.log'),
    );
  });

  it("seulement les lignes écrites après l'activation, dans l'ordre", async () => {
    await writeFile(file, loot(5, 'Poudre') + OTHER);
    const { watcher, onEvents, received } = await start();
    expect(onEvents).not.toHaveBeenCalled();
    await appendFile(file, loot(7, 'Serre de Kroapule') + OTHER + drop(30, 'Poudre'));
    await watcher.check();
    expect(received()).toEqual(['7 Serre de Kroapule', '-30 Poudre']);
    // Rien de nouveau : aucun appel.
    await watcher.check();
    expect(onEvents).toHaveBeenCalledTimes(1);
  });

  it('une ligne en cours d\'écriture attend sa fin, même coupée au milieu d\'un caractère', async () => {
    await writeFile(file, '');
    const { watcher, received } = await start();
    const line = Buffer.from(loot(2, 'Fibre Durable') + loot(1, 'Truffe du Désert'));
    const cut = line.lastIndexOf(Buffer.from('é')) + 1; // au milieu du « é » de « Désert »
    await appendFile(file, line.subarray(0, cut));
    await watcher.check();
    expect(received()).toEqual(['2 Fibre Durable']);
    await appendFile(file, line.subarray(cut));
    await watcher.check();
    expect(received()).toEqual(['2 Fibre Durable', '1 Truffe du Désert']);
  });

  it('fichier renommé en .1 par le jeu : fin de l\'ancien, puis le nouveau depuis le début', async () => {
    await writeFile(file, OTHER.repeat(20));
    const { watcher, received } = await start();
    await appendFile(file, loot(1, 'Fayot'));
    await rename(file, `${file}.1`);
    await writeFile(file, loot(2, 'Boolet'));
    await watcher.check();
    expect(received()).toEqual(['1 Fayot', '2 Boolet']);
  });

  it('fichier absent : signalé une fois, puis lu depuis le début dès que le jeu le crée', async () => {
    const { watcher, log, received } = await start();
    await watcher.check();
    expect(log.mock.calls.filter(([m]) => m.includes('introuvable'))).toHaveLength(1);
    await writeFile(file, loot(3, 'Poudre'));
    await watcher.check();
    expect(received()).toEqual(['3 Poudre']);
    expect(log).toHaveBeenLastCalledWith('chat de Wakfu : lecture reprise');
  });

  it('désactivé : plus rien n\'est lu ; réactivé : repart de la fin', async () => {
    await writeFile(file, '');
    const { watcher, received } = await start();
    watcher.setEnabled(false);
    await appendFile(file, loot(4, 'Poudre'));
    await watcher.check();
    watcher.setEnabled(true);
    await watcher.check();
    await appendFile(file, loot(1, 'Fayot'));
    await watcher.check();
    expect(received()).toEqual(['1 Fayot']);
  });

  it('craft lu en deux fois : les objets déjà annoncés sont joints au craft ; pas ceux lus avant une désactivation', async () => {
    await writeFile(file, '');
    const { watcher, received } = await start();
    await appendFile(file, drop(5, 'Truffe du Désert') + drop(5, 'Fayot'));
    await watcher.check();
    await appendFile(file, loot(1, 'Fibre Durable') + crafted('Fibre Durable'));
    await watcher.check();
    await appendFile(file, drop(5, 'Fayot'));
    await watcher.check();
    watcher.setEnabled(false);
    watcher.setEnabled(true);
    await watcher.check();
    await appendFile(file, loot(1, 'Fibre Durable') + crafted('Fibre Durable'));
    await watcher.check();
    expect(received()).toEqual([
      '-5 Truffe du Désert',
      '-5 Fayot',
      '1 Fibre Durable',
      'Fibre Durable crafté : -5 Truffe du Désert, -5 Fayot, 1 Fibre Durable',
      '-5 Fayot',
      '1 Fibre Durable',
      'Fibre Durable crafté : 1 Fibre Durable',
    ]);
  });
});
