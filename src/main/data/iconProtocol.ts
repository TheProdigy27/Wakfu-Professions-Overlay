// Protocole wicon://item/{gfxId} : le renderer affiche les icônes sans accès réseau.
import { protocol } from 'electron';
import type { IconResult } from './iconCache';

export const ICON_SCHEME = 'wicon';

/** À appeler avant app.whenReady(). */
export function registerIconScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: ICON_SCHEME, privileges: { standard: true, secure: true } }]);
}

export function handleIconProtocol(load: (gfxId: string) => Promise<IconResult>): void {
  protocol.handle(ICON_SCHEME, async (request) => {
    const url = new URL(request.url);
    const gfxId = url.hostname === 'item' ? url.pathname.replace(/^\//, '') : '';
    const result = await load(gfxId);
    if (result.status !== 200) return new Response(null, { status: result.status });
    return new Response(result.body, {
      headers: { 'content-type': 'image/png', 'cache-control': 'max-age=31536000, immutable' },
    });
  });
}
