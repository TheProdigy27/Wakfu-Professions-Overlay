// Dessin de l'icône de l'application, sans dépendance à Electron : carré arrondi orange avec trois lignes blanches,
// comme une liste. Sert à l'icône de la zone de notification (appIcon.ts) et à resources/icon.ico (scripts/make-icon.ts).

/** Le dessin est défini sur une grille de 32 unités, mise à l'échelle de la taille demandée. */
const GRID = 32;
const SAMPLES = 4;
const BACKGROUND = { r: 0xe2, g: 0x7a, b: 0x00 };

function inRoundedSquare(px: number, py: number): boolean {
  const r = 7;
  const cx = Math.min(Math.max(px, 1 + r), GRID - 1 - r);
  const cy = Math.min(Math.max(py, 1 + r), GRID - 1 - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function inLines(px: number, py: number): boolean {
  return [9, 15, 21].some((top) => py >= top && py < top + 3.5 && px >= 8 && px < (top === 21 ? 18 : 24));
}

/** Part du pixel (x, y) couverte par la forme, par suréchantillonnage. */
function coverage(x: number, y: number, scale: number, inside: (px: number, py: number) => boolean): number {
  let hits = 0;
  for (let i = 0; i < SAMPLES; i++) {
    for (let j = 0; j < SAMPLES; j++) {
      if (inside((x + (i + 0.5) / SAMPLES) * scale, (y + (j + 0.5) / SAMPLES) * scale)) hits++;
    }
  }
  return hits / (SAMPLES * SAMPLES);
}

/** Pixels RGBA (alpha non prémultiplié), ligne par ligne depuis le haut, pour une icône carrée de `size` pixels. */
export function drawAppIcon(size: number): Uint8Array {
  const scale = GRID / size;
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = coverage(x, y, scale, inRoundedSquare);
      const line = coverage(x, y, scale, inLines);
      const o = (y * size + x) * 4;
      rgba[o] = Math.round(BACKGROUND.r + (255 - BACKGROUND.r) * line);
      rgba[o + 1] = Math.round(BACKGROUND.g + (255 - BACKGROUND.g) * line);
      rgba[o + 2] = Math.round(BACKGROUND.b + (255 - BACKGROUND.b) * line);
      rgba[o + 3] = Math.round(255 * a);
    }
  }
  return rgba;
}
