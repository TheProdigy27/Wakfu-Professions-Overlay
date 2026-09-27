// Placement du panneau : une position mémorisée n'est reprise que si on peut encore attraper la fenêtre.
// Sans dépendance à Electron : les zones de travail des écrans sont passées en paramètre.
import type { Rect } from '../../core/state/schema';

export type { Rect };

/** Partie de l'en-tête (zone de déplacement) qui doit rester sur un écran : au moins 80 × 16 px. */
const GRAB = { width: 80, height: 16, header: 28 };
export const MARGIN = 24;

function overlap(a: Rect, b: Rect): { width: number; height: number } {
  return {
    width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  };
}

/** Vrai si une partie suffisante de l'en-tête est sur la zone de travail d'un écran. */
export function isReachable(bounds: Rect, workAreas: readonly Rect[]): boolean {
  const header = { ...bounds, height: Math.min(GRAB.header, bounds.height) };
  return workAreas.some((area) => {
    const o = overlap(header, area);
    return o.width >= Math.min(GRAB.width, bounds.width) && o.height >= Math.min(GRAB.height, header.height);
  });
}

/** Coin supérieur droit de l'écran principal, taille bornée à sa zone de travail. */
export function defaultBounds(size: { width: number; height: number }, primary: Rect): Rect {
  const width = Math.min(size.width, primary.width - 2 * MARGIN);
  const height = Math.min(size.height, primary.height - 2 * MARGIN);
  return { x: primary.x + primary.width - width - MARGIN, y: primary.y + MARGIN, width, height };
}

/**
 * Position à utiliser : la position mémorisée si elle est atteignable (écran toujours branché), sinon le coin
 * supérieur droit de l'écran principal, avec la taille mémorisée si elle y tient.
 */
export function placeWindow(
  saved: Rect | undefined,
  size: { width: number; height: number },
  workAreas: readonly Rect[],
  primary: Rect,
): Rect {
  if (saved && isReachable(saved, workAreas)) return saved;
  return defaultBounds(saved ?? size, primary);
}
