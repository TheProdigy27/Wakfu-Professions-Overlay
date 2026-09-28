import { describe, expect, it } from 'vitest';
import type { RecipeTuple } from '../../../src/core/data/indexFile';
import { loadIndex } from '../../../src/core/data/loadIndex';
import { computeNeeds, type NeedsInput } from '../../../src/core/needs/computeNeeds';
import { listCost, MAX_PRICE, priceAge, withPrice, type Prices } from '../../../src/core/needs/cost';
import { indexFile } from '../../helpers/synthetic';

const [BLE, FARINE, PAIN, EAU, SANDWICH, TARTINE] = [1, 2, 3, 4, 5, 6];
const NOW = new Date('2026-09-28T12:00:00.000Z');

/** Sandwich ← Pain ×2, Farine ; Pain ← Farine, Eau ; Farine ← Blé ×2. Tartine ← Pain ×2. */
function bakery(painYield = 1, sandwich: number[] = [PAIN, 2, FARINE, 1]) {
  const recipes: RecipeTuple[] = [
    [10, 1, 1, 0, FARINE, 1, [BLE, 2]],
    [11, 1, 1, 0, PAIN, painYield, [FARINE, 1, EAU, 1]],
    [12, 1, 1, 0, SANDWICH, 1, sandwich],
    [13, 1, 1, 0, TARTINE, 1, [PAIN, 2]],
  ];
  const items = ['Blé', 'Farine', 'Pain', 'Eau', 'Sandwich', 'Tartine'].map(
    (name, i) => [i + 1, name, 1, 1, 0, 0] as [number, string, number, number, number, number],
  );
  return loadIndex(indexFile({ items, recipes }), 'fr');
}

function prices(kamas: Record<number, number>): Prices {
  return Object.fromEntries(Object.entries(kamas).map(([id, k]) => [id, { kamas: k, at: NOW.toISOString() }]));
}

const ALL = prices({ [BLE]: 10, [EAU]: 5, [PAIN]: 40, [FARINE]: 30, [SANDWICH]: 500 });

function cost(input: NeedsInput, p: Prices = ALL, index = bakery()) {
  return listCost(index, input, computeNeeds(index, input), p);
}

describe('withPrice', () => {
  it('enregistre le prix entier avec sa date, borné entre 0 et MAX_PRICE', () => {
    expect(withPrice({}, BLE, 12.9, NOW)).toEqual({ [BLE]: { kamas: 12, at: NOW.toISOString() } });
    expect(withPrice({}, BLE, -5, NOW)[BLE]?.kamas).toBe(0);
    expect(withPrice({}, BLE, 1e12, NOW)[BLE]?.kamas).toBe(MAX_PRICE);
  });

  it('oublie le prix quand le champ est vidé, sans toucher aux autres', () => {
    const p = prices({ [BLE]: 10, [EAU]: 5 });
    expect(withPrice(p, BLE, null)).toEqual(prices({ [EAU]: 5 }));
    expect(withPrice(p, BLE, Number.NaN)).toEqual(prices({ [EAU]: 5 }));
    expect(p[BLE]).toBeDefined();
  });
});

describe('priceAge', () => {
  const at = (d: Date) => ({ kamas: 1, at: d.toISOString() });

  it('compte les jours du calendrier local', () => {
    const now = new Date(2026, 8, 28, 0, 30);
    expect(priceAge(at(new Date(2026, 8, 28, 0, 5)), now)).toBe(0);
    expect(priceAge(at(new Date(2026, 8, 27, 23, 50)), now)).toBe(1);
    expect(priceAge(at(new Date(2026, 8, 18, 9, 0)), now)).toBe(10);
  });

  it('date illisible ou dans le futur : 0', () => {
    expect(priceAge({ kamas: 1, at: 'hier' }, NOW)).toBe(0);
    expect(priceAge(at(new Date(NOW.getTime() + 3 * 86_400_000)), NOW)).toBe(0);
  });
});

describe('listCost', () => {
  const sandwich: NeedsInput = { targets: [{ itemId: SANDWICH, qty: 1 }] };

  it('coût de revient : ce qui reste à obtenir × prix, le stock ne coûte rien', () => {
    // Blé ×6, Eau ×2 à obtenir.
    expect(cost(sandwich).total).toEqual({ kamas: 70, priced: 2, unpriced: [] });
    expect(cost({ ...sandwich, owned: { [EAU]: 2, [BLE]: 1 } }).total).toEqual({ kamas: 50, priced: 1, unpriced: [] });
  });

  it('sans prix : liste les objets concernés et ne compare rien', () => {
    expect(cost(sandwich, {})).toEqual({ total: { kamas: 0, priced: 0, unpriced: [BLE, EAU] }, choices: new Map() });
    expect(cost(sandwich, prices({ [BLE]: 10 })).total).toEqual({ kamas: 60, priced: 1, unpriced: [EAU] });
  });

  it('compare crafter et acheter pour chaque objet crafté, cible comprise', () => {
    const { choices } = cost(sandwich);
    expect([...choices.keys()].sort()).toEqual([FARINE, PAIN, SANDWICH]);
    // Pain ×2 : Blé ×4 et Eau ×2 à crafter, ou 2 × 40 à acheter.
    expect(choices.get(PAIN)).toEqual({
      craft: { kamas: 50, priced: 2, unpriced: [] },
      buy: { kamas: 80, priced: 1, unpriced: [] },
      qty: 2,
    });
    // Farine ×3 en tout (2 pour le Pain, 1 pour le Sandwich) : Blé ×6, ou 3 × 30.
    expect(choices.get(FARINE)).toMatchObject({ craft: { kamas: 60 }, buy: { kamas: 90 }, qty: 3 });
    expect(choices.get(SANDWICH)).toMatchObject({ craft: { kamas: 70 }, buy: { kamas: 500 }, qty: 1 });
  });

  it("donne la même comparaison pour un objet en « j'achète »", () => {
    const { total, choices } = cost({ ...sandwich, mode: { [PAIN]: 'buy' } });
    expect(total.kamas).toBe(2 * 40 + 2 * 10);
    expect(choices.get(PAIN)).toEqual(cost(sandwich).choices.get(PAIN));
    // Farine : seulement celle du Sandwich.
    expect(choices.get(FARINE)).toMatchObject({ craft: { kamas: 20 }, buy: { kamas: 30 }, qty: 1 });
  });

  it("n'inclut pas les objets entièrement en stock", () => {
    const { choices } = cost({ ...sandwich, owned: { [PAIN]: 2 } });
    expect(choices.has(PAIN)).toBe(false);
    expect(choices.has(FARINE)).toBe(true);
  });

  it('tient compte du stock partagé : le Blé possédé que le Pain consomme manque ailleurs', () => {
    // Blé ×4 possédé : pris par la Farine du Pain (parcourue en premier), celle du Sandwich en achète 2.
    // En achetant le Pain, ces 4 Blé suffisent pour le reste : crafter le Pain coûte aussi ces 2 Blé.
    const { choices } = cost({ ...sandwich, owned: { [BLE]: 4 } });
    expect(choices.get(PAIN)).toMatchObject({ craft: { kamas: 2 * 10 + 2 * 5 }, buy: { kamas: 80 }, qty: 2 });
  });

  it('tient compte du surplus : un craft de 4 Pains couvre les deux besoins', () => {
    const index = bakery(4, [PAIN, 2, TARTINE, 1]);
    const { choices } = cost(sandwich, { ...ALL, ...prices({ [TARTINE]: 100 }) }, index);
    // Un seul craft : Farine (Blé ×2) et Eau, contre 4 Pains achetés.
    expect(choices.get(PAIN)).toMatchObject({ craft: { kamas: 25 }, buy: { kamas: 160 }, qty: 4 });
  });

  it("signale les prix manquants de chaque option", () => {
    const { choices } = cost(sandwich, prices({ [BLE]: 10, [FARINE]: 30 }));
    expect(choices.get(PAIN)).toEqual({
      craft: { kamas: 40, priced: 1, unpriced: [EAU] },
      buy: { kamas: 0, priced: 0, unpriced: [PAIN] },
      qty: 2,
    });
  });
});
