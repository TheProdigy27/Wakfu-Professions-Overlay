// Icône de la zone de notification, dessinée par le code (même dessin que resources/icon.ico).
import { nativeImage, type NativeImage } from 'electron';
import { drawAppIcon } from './appIconPixels';

const SIZE = 32;

export function createAppIcon(): NativeImage {
  // Pixels BGRA prémultipliés, format de nativeImage.createFromBitmap sous Windows.
  const rgba = drawAppIcon(SIZE);
  const bitmap = Buffer.alloc(rgba.length);
  for (let o = 0; o < rgba.length; o += 4) {
    const a = rgba[o + 3]! / 255;
    bitmap[o] = Math.round(rgba[o + 2]! * a);
    bitmap[o + 1] = Math.round(rgba[o + 1]! * a);
    bitmap[o + 2] = Math.round(rgba[o]! * a);
    bitmap[o + 3] = rgba[o + 3]!;
  }
  return nativeImage.createFromBitmap(bitmap, { width: SIZE, height: SIZE, scaleFactor: 2 });
}
