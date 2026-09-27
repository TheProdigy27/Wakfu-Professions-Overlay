// Génère, à partir de resources/icon.svg :
// - resources/icon.ico : exécutable, installeur, raccourcis, zone de notification et fenêtre. Tailles usuelles de Windows ;
//   256 px en PNG, les autres en BMP 32 bits (lus par toutes les versions de Windows et par NSIS) ;
// - resources/icon.png (256 px) : README ;
// - resources/installerSidebar.bmp (164 × 314) : bandeau des pages d'accueil et de fin de l'installeur et du désinstalleur.
// Usage : npm run icon
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const RESOURCES = path.resolve(import.meta.dirname, '../resources');
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const svg = readFileSync(path.join(RESOURCES, 'icon.svg'), 'utf8');

function render(source: string, width: number): { png: Buffer; rgba: Uint8Array; height: number } {
  const image = new Resvg(source, { fitTo: { mode: 'width', value: width } }).render();
  // resvg rend des pixels à alpha prémultiplié : on revient à l'alpha simple des BMP.
  const rgba = new Uint8Array(image.pixels);
  for (let o = 0; o < rgba.length; o += 4) {
    const a = rgba[o + 3]!;
    if (a > 0 && a < 255) for (let c = 0; c < 3; c++) rgba[o + c] = Math.min(255, Math.round((rgba[o + c]! * 255) / a));
  }
  return { png: image.asPng(), rgba, height: image.height };
}

/** BMP d'icône : en-tête BITMAPINFOHEADER (hauteur doublée), pixels BGRA de bas en haut, puis masque AND vide. */
function iconBmp(size: number, rgba: Uint8Array): Buffer {
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

function ico(): Buffer {
  const images = SIZES.map((size) => {
    const { png, rgba } = render(svg, size);
    return { size, data: size >= 256 ? png : iconBmp(size, rgba) };
  });
  const dir = Buffer.alloc(6 + 16 * images.length);
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
  return Buffer.concat([dir, ...images.map((i) => i.data)]);
}

/** BMP 24 bits opaque (bandeau NSIS) : lignes BGR de bas en haut, complétées à un multiple de 4 octets. */
function opaqueBmp(width: number, height: number, rgba: Uint8Array): Buffer {
  const row = Math.ceil((width * 3) / 4) * 4;
  const header = Buffer.alloc(54);
  header.write('BM', 0, 'ascii');
  header.writeUInt32LE(54 + row * height, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(row * height, 34);
  const pixels = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = (height - 1 - y) * row + x * 3;
      pixels[dst] = rgba[src + 2]!;
      pixels[dst + 1] = rgba[src + 1]!;
      pixels[dst + 2] = rgba[src]!;
    }
  }
  return Buffer.concat([header, pixels]);
}

/** Bandeau de l'installeur : fond sombre aux couleurs de l'application, icône en haut. */
function sidebar(): Buffer {
  const [width, height, iconSize] = [164, 314, 116];
  const icon = `data:image/png;base64,${render(svg, iconSize).png.toString('base64')}`;
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2621"/><stop offset="1" stop-color="#16181d"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <image href="${icon}" x="${(width - iconSize) / 2}" y="44" width="${iconSize}" height="${iconSize}"/>
  </svg>`;
  return opaqueBmp(width, height, render(source, width).rgba);
}

const outputs: [string, Buffer][] = [
  ['icon.ico', ico()],
  ['icon.png', render(svg, 256).png],
  ['installerSidebar.bmp', sidebar()],
];
for (const [name, data] of outputs) {
  writeFileSync(path.join(RESOURCES, name), data);
  console.log(`resources/${name} : ${data.length} octets`);
}
