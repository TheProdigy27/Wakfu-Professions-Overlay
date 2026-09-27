import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameIndex } from '../../src/core/data/loadIndex';
import { computeNeeds } from '../../src/core/needs/computeNeeds';
import { craftOrder } from '../../src/core/needs/craftOrder';
import { shoppingList } from '../../src/core/needs/shopping';
import { drawArbitrary, inputFromDraw, mrpOracle, needsAsOracle } from '../helpers/mrpOracle';
import { needsCases, observe } from '../helpers/needsCases';
import { buildRealIndex, REAL_DATA_VERSION } from '../helpers/realData';

let index: GameIndex;
beforeAll(async () => {
  index = (await buildRealIndex()).index;
});

describe(`données réelles ${REAL_DATA_VERSION} : cas de test de référence`, () => {
  it('T1a–d, T2a–c, T3a–c', () => {
    for (const c of needsCases(index)) {
      const { actual, expected } = observe(index, c);
      expect(actual, c.name).toEqual(expected);
    }
  });
});

describe(`données réelles ${REAL_DATA_VERSION} : balayage et propriété`, () => {
  it('computeNeeds sur les 5 159 objets craftables : aucune exception, chaque appel < 5 ms', () => {
    const craftable = [...index.recipesByItem.keys()];
    for (const itemId of craftable.slice(0, 200)) computeNeeds(index, { targets: [{ itemId, qty: 1 }] }); // échauffement
    let max = 0;
    let slowest = 0;
    let total = 0;
    for (const itemId of craftable) {
      const input = { targets: [{ itemId, qty: 1 }] };
      const t0 = performance.now();
      const res = computeNeeds(index, input);
      const ms = performance.now() - t0;
      total += ms;
      if (ms > max) [max, slowest] = [ms, itemId];
      expect(res.unknownItemIds).toEqual([]);
      shoppingList(index, res, input);
      craftOrder(index, res);
    }
    console.log(
      `${craftable.length} objets : moyenne ${(total / craftable.length).toFixed(3)} ms, max ${max.toFixed(2)} ms (${index.items.get(slowest)?.name})`,
    );
    expect(craftable).toHaveLength(5159);
    expect(max).toBeLessThan(5);
  });

  it('parcours en profondeur = oracle MRP, 500 tirages sur les données complètes', () => {
    const craftable = [...index.recipesByItem.keys()].sort((a, b) => a - b);
    fc.assert(
      fc.property(drawArbitrary, (draw) => {
        const input = inputFromDraw(index, craftable, draw);
        expect(needsAsOracle(index, input)).toEqual(mrpOracle(index, input));
      }),
      { numRuns: 500 },
    );
  });
});
