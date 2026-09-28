// Icônes des objets : cache disque (icons/{gfxId}.png), sinon CDN Ankama. Sans dépendance à Electron.
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { writeFileAtomic } from '../store/atomicWrite';
import type { FetchLike } from './gamedataService';

export const ICON_CDN = 'https://static.ankama.com/wakfu/portal/game/item/64';

/** 200 : image PNG ; 404 : icône inexistante (le CDN répond 403) ; 503 : réseau indisponible, à retenter plus tard. */
export type IconResult = { status: 200; body: Uint8Array } | { status: 404 } | { status: 503 };

export interface IconLoaderOptions {
  /** Dossier de l'application : les icônes vont dans son sous-dossier icons\. */
  dir: string;
  fetch?: FetchLike;
  cdn?: string;
  timeoutMs?: number;
  log?: (message: string) => void;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (b: Uint8Array) => PNG_SIGNATURE.every((v, i) => b[i] === v);

/**
 * Icône que le CDN sert retournée verticalement : celles converties par Ankama en mars 2026 portent un bloc gAMA et pas
 * le bloc orNT (orientation) qu'écrit la conversion actuelle. Une icône reconvertie depuis est à l'endroit.
 */
export function isUpsideDown(png: Uint8Array): boolean {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let gamma = false;
  for (let p = PNG_SIGNATURE.length; p + 8 <= png.length; p += 12 + view.getUint32(p)) {
    const type = String.fromCharCode(...png.subarray(p + 4, p + 8));
    if (type === 'orNT') return false;
    if (type === 'gAMA') gamma = true;
    if (type === 'IEND') break;
  }
  return gamma;
}

export function createIconLoader(options: IconLoaderOptions): (gfxId: string) => Promise<IconResult> {
  const fetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const cdn = options.cdn ?? ICON_CDN;
  const dir = path.join(options.dir, 'icons');
  const inflight = new Map<string, Promise<IconResult>>();
  // Ids sans icône : pas de nouvelle requête pendant la session.
  const missing = new Set<string>();

  const load = async (gfxId: string): Promise<IconResult> => {
    const file = path.join(dir, `${gfxId}.png`);
    if (existsSync(file)) return { status: 200, body: new Uint8Array(await readFile(file)) };
    try {
      const res = await fetch(`${cdn}/${gfxId}.png`, { signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });
      if (res.status === 403 || res.status === 404) {
        missing.add(gfxId);
        return { status: 404 };
      }
      const body = new Uint8Array(await res.arrayBuffer());
      if (!res.ok || !isPng(body)) throw new Error(`HTTP ${res.status}${res.ok ? ', contenu non PNG' : ''}`);
      await mkdir(dir, { recursive: true });
      await writeFileAtomic(file, body);
      return { status: 200, body };
    } catch (err) {
      options.log?.(`icône ${gfxId} : ${err instanceof Error ? err.message : String(err)}`);
      return { status: 503 };
    }
  };

  return (gfxId) => {
    if (!/^\d{1,12}$/.test(gfxId) || missing.has(gfxId)) return Promise.resolve({ status: 404 });
    let pending = inflight.get(gfxId);
    if (!pending) {
      pending = load(gfxId).finally(() => inflight.delete(gfxId));
      inflight.set(gfxId, pending);
    }
    return pending;
  };
}
