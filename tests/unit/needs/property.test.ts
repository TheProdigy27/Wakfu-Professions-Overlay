import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeNeeds } from '../../../src/core/needs/computeNeeds';
import { loadFixture } from '../../helpers/fixture';
import { drawArbitrary, inputFromDraw, mrpOracle, needsAsOracle } from '../../helpers/mrpOracle';

describe('propriété : parcours en profondeur = oracle MRP', () => {
  const { index } = loadFixture();
  const craftable = [...index.recipesByItem.keys()].sort((a, b) => a - b);

  it('500 tirages (objet, quantité, stocks, achats, variantes)', () => {
    fc.assert(
      fc.property(drawArbitrary, (draw) => {
        const input = inputFromDraw(index, craftable, draw);
        expect(needsAsOracle(index, input)).toEqual(mrpOracle(index, input));
      }),
      { numRuns: 500 },
    );
  });

  it('le stock restant ne devient jamais négatif et la demande est couverte', () => {
    fc.assert(
      fc.property(drawArbitrary, (draw) => {
        const input = inputFromDraw(index, craftable, draw);
        const res = computeNeeds(index, input);
        for (const q of res.leftover.values()) expect(q).toBeGreaterThan(0);
        for (const t of res.totals.values()) {
          // Toute la demande est servie : par le stock, par des crafts (surplus compris) ou à obtenir.
          expect(t.fromStock + t.toObtain).toBeLessThanOrEqual(t.demand);
          if (t.crafts === 0) expect(t.fromStock + t.toObtain).toBe(t.demand);
        }
      }),
      { numRuns: 200 },
    );
  });
});
