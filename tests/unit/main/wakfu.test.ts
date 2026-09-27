import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasWakfuWindow, POLL_MS, WakfuWatcher } from '../../../src/main/wakfu';

/** Ligne de `tasklist /v /fo csv /nh` (Windows en français) pour un processus javaw.exe. */
const row = (title: string) =>
  `"javaw.exe","9044","Console","9","9 439 164 Ko","Running","PC\\joueur","0:51:58","${title.replace(/"/g, '""')}"`;
const NONE = 'Information : aucune tâche en service ne correspond aux critères spécifiés.\r\n';

describe('hasWakfuWindow', () => {
  it('reconnaît la fenêtre du jeu, sur l\'écran de connexion comme en jeu', () => {
    expect(hasWakfuWindow(`${row('WAKFU')}\r\n`)).toBe(true);
    expect(hasWakfuWindow(`${row('Personnage - WAKFU')}\r\n`)).toBe(true);
    // Plusieurs comptes, ou un autre jeu Java à côté.
    expect(hasWakfuWindow(`${row('Minecraft 1.21')}\r\n${row('Personnage - WAKFU')}\r\n`)).toBe(true);
  });

  it('ignore les autres applications Java et la phrase écrite sans processus', () => {
    expect(hasWakfuWindow(NONE)).toBe(false);
    expect(hasWakfuWindow('')).toBe(false);
    expect(hasWakfuWindow(`${row('N/A')}\r\n${row('Minecraft 1.21')}\r\n`)).toBe(false);
    expect(hasWakfuWindow(`${row('Guide "Wakfu", WAKFUTEUR')}\r\n`)).toBe(false);
  });
});

describe('WakfuWatcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(outputs: (string | Error)[]) {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const log = vi.fn();
    const list = vi.fn(async () => {
      const next = outputs.length > 1 ? outputs.shift()! : outputs[0]!;
      if (next instanceof Error) throw next;
      return next;
    });
    const watcher = new WakfuWatcher({ onStart, onStop, log, list });
    return { watcher, onStart, onStop, log, list };
  }
  const tick = () => vi.advanceTimersByTimeAsync(POLL_MS);
  const WAKFU = row('Personnage - WAKFU');

  it('lancement puis fermeture du jeu : un seul appel chacun', async () => {
    const { watcher, onStart, onStop } = setup([NONE, NONE, WAKFU, WAKFU, WAKFU, NONE, NONE]);
    watcher.setEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    await tick();
    expect(onStart).not.toHaveBeenCalled();
    await tick();
    expect(onStart).toHaveBeenCalledTimes(1);
    await tick();
    await tick();
    expect(onStop).not.toHaveBeenCalled();
    await tick();
    await tick();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('jeu déjà lancé à l\'activation : compte comme un lancement', async () => {
    const { watcher, onStart } = setup([WAKFU]);
    watcher.setEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('désactivé : plus aucune vérification, même celle en cours', async () => {
    const { watcher, onStart, list } = setup([WAKFU]);
    watcher.setEnabled(true);
    watcher.setEnabled(false);
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(onStart).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('réactivé : une seule boucle de vérification', async () => {
    const { watcher, list } = setup([NONE]);
    watcher.setEnabled(true);
    watcher.setEnabled(false);
    watcher.setEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    await tick();
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('tasklist en échec : panneau inchangé, une ligne de journal par série d\'échecs', async () => {
    const fail = new Error('tasklist introuvable');
    const { watcher, onStart, onStop, log } = setup([WAKFU, fail, fail, WAKFU, fail, NONE]);
    watcher.setEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    await tick();
    await tick();
    expect(onStop).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('détection de Wakfu impossible : tasklist introuvable');
    await tick();
    await tick();
    expect(log).toHaveBeenCalledTimes(2);
    await tick();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
