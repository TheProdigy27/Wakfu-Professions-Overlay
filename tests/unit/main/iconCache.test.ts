import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FetchLike } from '../../../src/main/data/gamedataService';
import { createIconLoader } from '../../../src/main/data/iconCache';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const CDN = 'https://icons.test';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'icons-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function mockFetch(respond: (gfxId: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    const gfxId = url.replace(`${CDN}/`, '').replace('.png', '');
    calls.push(gfxId);
    return respond(gfxId);
  };
  return { fetch, calls };
}

describe('createIconLoader', () => {
  it('télécharge, met en cache sur disque, puis sert le cache sans réseau', async () => {
    const cdn = mockFetch(() => new Response(PNG));
    const load = createIconLoader({ dir, fetch: cdn.fetch, cdn: CDN });
    expect(await load('13416969')).toEqual({ status: 200, body: PNG });
    expect(new Uint8Array(await readFile(path.join(dir, 'icons', '13416969.png')))).toEqual(PNG);

    const offline = mockFetch(() => {
      throw new TypeError('fetch failed');
    });
    const again = createIconLoader({ dir, fetch: offline.fetch, cdn: CDN });
    expect(await again('13416969')).toEqual({ status: 200, body: PNG });
    expect(offline.calls).toEqual([]);
  });

  it('icône inexistante (403 du CDN) : 404, sans nouvelle requête pendant la session', async () => {
    const cdn = mockFetch(() => new Response('<Error/>', { status: 403 }));
    const load = createIconLoader({ dir, fetch: cdn.fetch, cdn: CDN });
    expect(await load('99999999')).toEqual({ status: 404 });
    expect(await load('99999999')).toEqual({ status: 404 });
    expect(cdn.calls).toEqual(['99999999']);
    expect(existsSync(path.join(dir, 'icons', '99999999.png'))).toBe(false);
  });

  it('réseau indisponible ou réponse invalide : 503, retenté plus tard, rien en cache', async () => {
    let mode: 'down' | 'html' | 'error' | 'ok' = 'down';
    const cdn = mockFetch(() => {
      if (mode === 'down') throw new TypeError('fetch failed');
      if (mode === 'html') return new Response('<html>');
      if (mode === 'error') return new Response('', { status: 500 });
      return new Response(PNG);
    });
    const logs: string[] = [];
    const load = createIconLoader({ dir, fetch: cdn.fetch, cdn: CDN, log: (m) => logs.push(m) });
    expect(await load('1')).toEqual({ status: 503 });
    mode = 'html';
    expect(await load('1')).toEqual({ status: 503 });
    mode = 'error';
    expect(await load('1')).toEqual({ status: 503 });
    expect(existsSync(path.join(dir, 'icons', '1.png'))).toBe(false);
    mode = 'ok';
    expect(await load('1')).toEqual({ status: 200, body: PNG });
    expect(cdn.calls).toHaveLength(4);
    expect(logs).toEqual(['icône 1 : fetch failed', 'icône 1 : HTTP 200, contenu non PNG', 'icône 1 : HTTP 500']);
  });

  it('refuse les identifiants non numériques (aucun accès disque ni réseau)', async () => {
    const cdn = mockFetch(() => new Response(PNG));
    const load = createIconLoader({ dir, fetch: cdn.fetch, cdn: CDN });
    for (const id of ['', '../secret', '12a', '1'.repeat(13)]) expect(await load(id)).toEqual({ status: 404 });
    expect(cdn.calls).toEqual([]);
  });

  it('une seule requête pour des demandes simultanées', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const cdn = mockFetch(async () => {
      await gate;
      return new Response(PNG);
    });
    const load = createIconLoader({ dir, fetch: cdn.fetch, cdn: CDN });
    const pending = [load('5'), load('5'), load('5')];
    release();
    const results = await Promise.all(pending);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(cdn.calls).toEqual(['5']);
  });
});
