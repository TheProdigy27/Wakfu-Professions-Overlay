import type { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// electron-updater simulé : événements émis par la recherche elle-même, comme le vrai.
vi.mock('electron-updater', async () => {
  const { EventEmitter } = await import('node:events');
  return { default: { autoUpdater: Object.assign(new EventEmitter(), { checkForUpdates: vi.fn(), quitAndInstall: vi.fn() }) } };
});

const { default: electronUpdater } = await import('electron-updater');
const { CHECK_EVERY_MS, summary, TICK_MS, Updater } = await import('../../../src/main/updater');

const autoUpdater = electronUpdater.autoUpdater as unknown as EventEmitter & { checkForUpdates: Mock };

describe('summary (journal des mises à jour)', () => {
  it("réduit une erreur HTTP d'electron-updater à sa première ligne et à l'URL, sans en-têtes ni cookies", () => {
    const error = [
      'Error: HttpError: 404 ',
      '"method: GET url: https://github.com/o/r/releases.atom\\n\\nPlease double check that your authentication token is correct."',
      'Headers: {',
      '  "set-cookie": [',
      '    "_gh_sess=abc; path=/; secure; HttpOnly; SameSite=Lax"',
      '  ]',
      '}',
      '    at createHttpError (httpExecutor.js:53:12)',
    ].join('\n');
    expect(summary(error)).toBe('Error: HttpError: 404 (https://github.com/o/r/releases.atom)');
  });

  it('garde les messages simples tels quels', () => {
    expect(summary('Checking for update')).toBe('Checking for update');
    expect(summary(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe('Error: net::ERR_INTERNET_DISCONNECTED');
  });
});

describe('Updater : vérifications automatiques', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    autoUpdater.removeAllListeners();
    // Aucune nouvelle version publiée.
    autoUpdater.checkForUpdates.mockReset().mockImplementation(async () => {
      autoUpdater.emit('checking-for-update');
      autoUpdater.emit('update-not-available');
      return null;
    });
  });
  afterEach(() => vi.useRealTimers());

  const create = (options: { available?: boolean; enabled?: boolean } = {}) =>
    new Updater({ available: true, enabled: true, log: () => {}, ...options });

  it("vérifie au démarrage, puis toutes les heures tant que l'application est ouverte", async () => {
    create().start();
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS - TICK_MS);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(TICK_MS);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it("affichage du panneau : ne revérifie que si la dernière vérification date d'une heure", async () => {
    const updater = create();
    updater.start();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS / 2);
    updater.checkIfStale();
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    // Mise en veille : l'échéance se lit sur l'horloge, sans attendre la minuterie.
    vi.setSystemTime(Date.now() + CHECK_EVERY_MS);
    updater.checkIfStale();
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('version publiée pendant la session : téléchargée, prête, puis plus aucune vérification', async () => {
    const updater = create();
    updater.start();
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      autoUpdater.emit('checking-for-update');
      autoUpdater.emit('update-available', { version: '9.9.9' });
      autoUpdater.emit('update-downloaded', { version: '9.9.9' });
      return null;
    });
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(updater.status).toEqual({ state: 'ready', version: '9.9.9' });
    await vi.advanceTimersByTimeAsync(5 * CHECK_EVERY_MS);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('mises à jour automatiques désactivées : aucune vérification, sauf la recherche manuelle', async () => {
    const updater = create({ enabled: false });
    updater.start();
    await vi.advanceTimersByTimeAsync(3 * CHECK_EVERY_MS);
    updater.checkIfStale();
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    await updater.check();
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('hors de la version installée : ni vérification ni minuterie', async () => {
    create({ available: false }).start();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(3 * CHECK_EVERY_MS);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });
});
