// Protocole wicon://item/{gfxId} : le renderer affiche les icônes sans accès réseau.
import { nativeImage, protocol } from 'electron';
import { isUpsideDown, type IconResult } from './iconCache';

export const ICON_SCHEME = 'wicon';

/** À appeler avant app.whenReady(). */
export function registerIconScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: ICON_SCHEME, privileges: { standard: true, secure: true } }]);
}

/** Lignes de pixels dans l'ordre inverse ; l'image telle quelle si elle ne se décode pas. */
function flipVertically(png: Uint8Array): Uint8Array {
  const image = nativeImage.createFromBuffer(Buffer.from(png.buffer, png.byteOffset, png.byteLength));
  if (image.isEmpty()) return png;
  const { width, height } = image.getSize();
  const pixels = image.toBitmap();
  const row = pixels.length / height;
  const flipped = Buffer.alloc(pixels.length);
  for (let y = 0; y < height; y++) pixels.copy(flipped, (height - 1 - y) * row, y * row, (y + 1) * row);
  return nativeImage.createFromBitmap(flipped, { width, height }).toPNG();
}

export function handleIconProtocol(load: (gfxId: string) => Promise<IconResult>): void {
  protocol.handle(ICON_SCHEME, async (request) => {
    const url = new URL(request.url);
    const gfxId = url.hostname === 'item' ? url.pathname.replace(/^\//, '') : '';
    const result = await load(gfxId);
    if (result.status !== 200) return new Response(null, { status: result.status });
    // Le cache disque garde l'icône du CDN telle quelle : la correction suit si Ankama la reconvertit.
    const body = isUpsideDown(result.body) ? flipVertically(result.body) : result.body;
    return new Response(body, {
      headers: { 'content-type': 'image/png', 'cache-control': 'max-age=31536000, immutable' },
    });
  });
}
