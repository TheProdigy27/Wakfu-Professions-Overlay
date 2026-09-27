// Génère resources/icon.ico (exécutable, installeur, raccourcis) à partir du dessin de src/main/appIconPixels.ts.
// Tailles usuelles de Windows ; 256 px en PNG, les autres en BMP 32 bits (lus par toutes les versions de Windows et par NSIS).
// Usage : npm run icon
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { drawAppIcon } from '../src/main/appIconPixels';

const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const OUT = path.resolve(import.meta.dirname, '../resources/icon.ico');

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits par composante
  ihdr[9] = 6; // RGBA
  // Chaque ligne commence par son filtre (0 : aucun).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** BMP d'icône : en-tête BITMAPINFOHEADER (hauteur doublée), pixels BGRA de bas en haut, puis masque AND vide. */
function bmp(size: number, rgba: Uint8Array): Buffer {
  const maskRow = Math.ceil(size / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = ((size - 1 - y) * size + x) * 4;
      pixels[dst] = rgba[src + 2]!;
      pixels[dst + 1] = rgba[src + 1]!;
      pixels[dst + 2] = rgba[src]!;
      pixels[dst + 3] = rgba[src + 3]!;
    }
  }
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)]);
}

const images = SIZES.map((size) => {
  const rgba = drawAppIcon(size);
  return { size, data: size >= 256 ? png(size, rgba) : bmp(size, rgba) };
});

const dir = Buffer.alloc(6 + 16 * images.length);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2); // icône
dir.writeUInt16LE(images.length, 4);
let offset = dir.length;
images.forEach(({ size, data }, i) => {
  const e = 6 + 16 * i;
  dir[e] = size >= 256 ? 0 : size; // 0 signifie 256
  dir[e + 1] = size >= 256 ? 0 : size;
  dir.writeUInt16LE(1, e + 4); // plans
  dir.writeUInt16LE(32, e + 6); // bits par pixel
  dir.writeUInt32LE(data.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += data.length;
});

await writeFile(OUT, Buffer.concat([dir, ...images.map((i) => i.data)]));
console.log(`${path.relative(process.cwd(), OUT)} : ${SIZES.join(', ')} px, ${offset} octets`);
