import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../helpers/fixture';
import { needsCases, observe } from '../../helpers/needsCases';

describe('cas de test de référence sur la fixture', () => {
  const { index } = loadFixture();
  for (const c of needsCases(index)) {
    it(c.name, () => {
      const { actual, expected } = observe(index, c);
      expect(actual).toEqual(expected);
    });
  }
});
