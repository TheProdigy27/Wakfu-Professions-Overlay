import { describe, expect, it } from 'vitest';
import { defaultBounds, isReachable, MARGIN, placeWindow } from '../../../src/main/windows/placement';

// Deux écrans : principal 1920×1080 (barre des tâches en bas), secondaire à gauche en 2560×1440 (décalé vers le haut).
const PRIMARY = { x: 0, y: 0, width: 1920, height: 1040 };
const LEFT = { x: -2560, y: -200, width: 2560, height: 1400 };
const SIZE = { width: 420, height: 640 };

describe('isReachable', () => {
  it('vrai tant qu\'une partie suffisante de l\'en-tête est sur un écran', () => {
    expect(isReachable({ x: 100, y: 100, ...SIZE }, [PRIMARY])).toBe(true);
    expect(isReachable({ x: -2000, y: 300, ...SIZE }, [PRIMARY, LEFT])).toBe(true);
    // À cheval sur les deux écrans.
    expect(isReachable({ x: -200, y: 10, ...SIZE }, [PRIMARY, LEFT])).toBe(true);
    // Débordant à droite, mais 100 px d'en-tête visibles.
    expect(isReachable({ x: 1820, y: 10, ...SIZE }, [PRIMARY])).toBe(true);
  });

  it('faux quand l\'écran qui contenait la fenêtre est débranché', () => {
    expect(isReachable({ x: -2000, y: 300, ...SIZE }, [PRIMARY])).toBe(false);
  });

  it('faux quand seul un bout de fenêtre dépasse, ou que l\'en-tête est hors de la zone de travail', () => {
    expect(isReachable({ x: 1880, y: 10, ...SIZE }, [PRIMARY])).toBe(false);
    expect(isReachable({ x: 100, y: 1030, ...SIZE }, [PRIMARY])).toBe(false);
    expect(isReachable({ x: 100, y: -20, ...SIZE }, [PRIMARY])).toBe(false);
  });
});

describe('placeWindow', () => {
  it('reprend la position mémorisée si elle est atteignable', () => {
    const saved = { x: -2000, y: 300, ...SIZE };
    expect(placeWindow(saved, SIZE, [PRIMARY, LEFT], PRIMARY)).toBe(saved);
  });

  it('écran débranché : coin supérieur droit de l\'écran principal, taille mémorisée', () => {
    const saved = { x: -2000, y: 300, width: 500, height: 700 };
    expect(placeWindow(saved, SIZE, [PRIMARY], PRIMARY)).toEqual({
      x: 1920 - 500 - MARGIN,
      y: MARGIN,
      width: 500,
      height: 700,
    });
  });

  it('sans position mémorisée : coin supérieur droit, taille par défaut bornée à l\'écran', () => {
    expect(placeWindow(undefined, SIZE, [PRIMARY], PRIMARY)).toEqual(defaultBounds(SIZE, PRIMARY));
    const small = { x: 0, y: 0, width: 800, height: 600 };
    expect(defaultBounds(SIZE, small)).toEqual({ x: 800 - 420 - MARGIN, y: MARGIN, width: 420, height: 600 - 2 * MARGIN });
  });
});
