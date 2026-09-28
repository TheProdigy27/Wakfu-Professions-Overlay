import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState, type PersistedState } from '../../../src/core/state/schema';
import { JsonStore, SAVE_DELAY_MS } from '../../../src/main/store/jsonStore';
import { readStateV1, readStateV6, STATE_V1_PATH, STATE_V6_PATH } from '../../helpers/fixture';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'state-'));
});
afterEach(async () => {
  vi.useRealTimers();
  await rm(dir, { recursive: true, force: true });
});

const statePath = () => path.join(dir, 'state.json');
const readState = async () => JSON.parse(await readFile(statePath(), 'utf8')) as PersistedState;
const withOpacity = (opacity: number) => (s: PersistedState): PersistedState => ({ ...s, settings: { ...s.settings, opacity } });
const NOW = () => new Date('2026-09-26T18:40:12.345Z');

describe('JsonStore : chargement', () => {
  it('premier lancement : état par défaut, rien d\'écrit tant que rien ne change', () => {
    const store = new JsonStore({ dir });
    expect(store.get()).toEqual(defaultState());
    expect(store.loadProblem).toBeNull();
    store.flush();
    expect(existsSync(statePath())).toBe(false);
  });

  it('relit un state.json au format courant', async () => {
    await writeFile(statePath(), await readFile(STATE_V6_PATH));
    const store = new JsonStore({ dir });
    expect(store.get()).toEqual(readStateV6());
    expect(store.loadProblem).toBeNull();
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('format ancien : copie state.v{n}.bak.json, puis migration', async () => {
    await writeFile(statePath(), await readFile(STATE_V1_PATH));
    const log = vi.fn();
    const store = new JsonStore({ dir, log });
    // Format 1 → 6 : langue de Windows, panneau pas affiché avec Wakfu, aucun niveau de métier, quantités pas mises à
    // jour avec le chat, aucun prix, tout le reste gardé.
    const v1 = readStateV1() as PersistedState;
    expect(store.get()).toEqual({
      ...v1,
      schemaVersion: 6,
      settings: { ...v1.settings, language: null, showWithWakfu: false, ownedFromChat: false },
      jobLevels: {},
      prices: {},
    });
    expect(store.loadProblem).toBeNull();
    expect(JSON.parse(await readFile(path.join(dir, 'state.v1.bak.json'), 'utf8'))).toEqual(v1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('migration du format 1 au format 6'));
  });

  it('fichier illisible : renommé state.corrupt-{date}.json, état vierge et problème signalé', async () => {
    await writeFile(statePath(), '{"schemaVersion": 1, "settings": ');
    const store = new JsonStore({ dir, now: NOW });
    expect(store.get()).toEqual(defaultState());
    expect(store.loadProblem).toEqual({ kind: 'corrupt', file: 'state.corrupt-2026-09-26T18-40-12-345Z.json' });
    expect(await readdir(dir)).toEqual(['state.corrupt-2026-09-26T18-40-12-345Z.json']);
  });

  it('fichier invalide (validation zod) : même traitement', async () => {
    await writeFile(statePath(), JSON.stringify({ ...(readStateV6() as object), history: 'rien' }));
    const store = new JsonStore({ dir, now: NOW });
    expect(store.get()).toEqual(defaultState());
    expect(store.loadProblem?.kind).toBe('corrupt');
    expect(existsSync(statePath())).toBe(false);
  });

  it('fichier d\'une version plus récente de l\'application : gardé à côté, jamais écrasé', async () => {
    const v9 = { ...(readStateV6() as object), schemaVersion: 9 };
    await writeFile(statePath(), JSON.stringify(v9));
    const store = new JsonStore({ dir });
    expect(store.get()).toEqual(defaultState());
    expect(store.loadProblem).toEqual({ kind: 'newer', file: 'state.v9.bak.json' });
    expect(JSON.parse(await readFile(path.join(dir, 'state.v9.bak.json'), 'utf8'))).toEqual(v9);
  });
});

describe('JsonStore : écriture', () => {
  it(`écrit au plus ${SAVE_DELAY_MS} ms après la première modification, en regroupant les suivantes`, async () => {
    vi.useFakeTimers();
    const store = new JsonStore({ dir });
    store.update(withOpacity(0.5));
    vi.advanceTimersByTime(SAVE_DELAY_MS - 100);
    store.update(withOpacity(0.6));
    expect(existsSync(statePath())).toBe(false);
    vi.advanceTimersByTime(100);
    expect((await readState()).settings.opacity).toBe(0.6);
    // Une modification continue (saisie) n'est jamais repoussée au-delà du délai.
    store.update(withOpacity(0.7));
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect((await readState()).settings.opacity).toBe(0.7);
  });

  it('flush écrit tout de suite ; une modification sans effet n\'écrit rien', async () => {
    vi.useFakeTimers();
    const store = new JsonStore({ dir });
    store.update((s) => s);
    store.flush();
    expect(existsSync(statePath())).toBe(false);
    store.update(withOpacity(0.4));
    store.flush();
    expect((await readState()).settings.opacity).toBe(0.4);
    expect(vi.getTimerCount()).toBe(0);
    // Relu à l'identique au lancement suivant.
    expect(new JsonStore({ dir }).get()).toEqual(store.get());
  });

  it('écriture impossible : erreur signalée, modifications gardées et réécrites ensuite', async () => {
    const store = new JsonStore({ dir });
    const errors: (string | null)[] = [];
    store.onSaveError((e) => errors.push(e));
    // Un dossier à la place du fichier temporaire bloque l'écriture.
    await mkdir(`${statePath()}.tmp`);
    store.update(withOpacity(0.5));
    store.flush();
    expect(store.saveError).toEqual(expect.any(String));
    await rm(`${statePath()}.tmp`, { recursive: true });
    store.flush();
    expect(store.saveError).toBeNull();
    expect(errors).toEqual([expect.any(String), null]);
    expect((await readState()).settings.opacity).toBe(0.5);
  });
});
