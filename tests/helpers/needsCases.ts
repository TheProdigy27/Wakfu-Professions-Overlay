// Cas de test de référence, valeurs calculées sur 1.93.1.62. Partagés entre la fixture et les données complètes.
import type { GameIndex } from '../../src/core/data/loadIndex';
import { computeNeeds, type NeedsInput } from '../../src/core/needs/computeNeeds';
import { craftOrder } from '../../src/core/needs/craftOrder';
import { shoppingList } from '../../src/core/needs/shopping';

export interface NeedsCase {
  name: string;
  input: NeedsInput;
  /** itemId → quantité restant à obtenir (ressources et intermédiaires achetés). */
  shop: Record<number, number>;
  /** itemId → nombre de crafts. */
  crafts: Record<number, number>;
  /** itemId → surplus d'un objet crafté. */
  surplus?: Record<number, number>;
  /** Intermédiaires attendus dans la section « achetés ». */
  bought?: number[];
  order?: number[];
}

export const IDS = {
  COIFFE_L: 23205,
  COIFFE_M: 16969,
  ORBE: 22483,
  FIBRE: 21031,
  FIL: 21664,
  BAGUETTE: 9362,
  PAIN_COMPLET: 8211,
  PAIN_FARLE: 8047,
  POUDRE: 27093,
  PONCTUATION_1: 29236, // !"(-è@)"
  PONCTUATION_2: 29238, // ".#@)é
} as const;

export function needsCases(index: GameIndex): NeedsCase[] {
  const id = (name: string): number => {
    const found = [...index.items.values()].filter((i) => i.name === name);
    if (found.length !== 1) throw new Error(`Nom non unique ou introuvable : ${name} (${found.length})`);
    return found[0]!.id;
  };
  const { COIFFE_L, COIFFE_M, ORBE, FIBRE, FIL, BAGUETTE, PAIN_COMPLET, PAIN_FARLE, POUDRE } = IDS;
  const ECLAT = id('Eclat de Taroudium'), KRAK = id('Krak-Ertz'), TRUFFE_A = id('Truffe Aromatisée');
  const SANG = id('Sang du Dragon-Cochon'), SIOU = id('Sioupère-Glou Durable'), TRUFFE_D = id('Truffe du Désert');
  const FAYOT = id('Fayot'), ALOA = id("Feuille d'Aloa Vero"), BOOLET = id('Boolet');
  const CHAMPI = id('Champignon Marbré'), POMMIER = id('Bois de Pommier'), CHATAIGNIER = id('Bois de Châtaignier');
  const CUIVRE = id('Minerai de Cuivre'), CHARBON = id('Charbon Antique'), SEAU = id("Seau d'eau"), SALACE = id('Salace');
  const CAWOTTE = id('Cawotte'), MANCHE = id('Manche Rudimentaire'), ACIER = id('Acier Rudimentaire');
  const FARINE_I = id('Farine Imparfaite'), FARINE_G = id('Farine Grossière'), TOPI = id('Topinambour');
  const PAILLE_BLE = id('Paille de Blé'), FIL_SERRAGE = id('Fil de serrage'), PAILLE_F = id('Paille Flaqueuse');

  const coiffe = (extra: Partial<NeedsInput> = {}): NeedsInput => ({ targets: [{ itemId: COIFFE_L, qty: 1 }], ...extra });
  const t1aShop = {
    [BOOLET]: 70, [ECLAT]: 5, [FAYOT]: 45, [ALOA]: 70, [KRAK]: 35,
    [POUDRE]: 21, [SANG]: 5, [SIOU]: 40, [TRUFFE_A]: 5, [TRUFFE_D]: 45,
  };
  const t1aCrafts = { [ORBE]: 5, [FIBRE]: 9, [FIL]: 14, [COIFFE_M]: 1, [COIFFE_L]: 1 };
  const t2aShop = {
    [CHATAIGNIER]: 25, [POMMIER]: 25, [CAWOTTE]: 5, [CHAMPI]: 57,
    [CHARBON]: 15, [CUIVRE]: 15, [SALACE]: 5, [SEAU]: 3,
  };
  const { [ECLAT]: _eclat, [KRAK]: _krak, ...t1aWithoutOrbeInputs } = t1aShop;

  return [
    { name: 'T1a Coiffe Lardante L ×1', input: coiffe(), shop: t1aShop, crafts: t1aCrafts, order: [ORBE, FIL, FIBRE, COIFFE_M, COIFFE_L] },
    {
      name: 'T1b possède Coiffe M ×1',
      input: coiffe({ owned: { [COIFFE_M]: 1 } }),
      shop: { [BOOLET]: 70, [ECLAT]: 3, [ALOA]: 70, [KRAK]: 21, [POUDRE]: 14, [SANG]: 3, [SIOU]: 25, [TRUFFE_A]: 3 },
      crafts: { [ORBE]: 3, [FIL]: 14, [COIFFE_L]: 1 },
    },
    {
      name: 'T1c possède Orbe Durable ×4 (stock partagé entre les 2 branches)',
      input: coiffe({ owned: { [ORBE]: 4 } }),
      shop: { ...t1aShop, [ECLAT]: 1, [KRAK]: 7 },
      crafts: { ...t1aCrafts, [ORBE]: 1 },
    },
    {
      name: "T1d Fil Durable en « j'achète »",
      input: coiffe({ mode: { [FIL]: 'buy' } }),
      shop: { [ECLAT]: 5, [FAYOT]: 45, [FIL]: 14, [KRAK]: 35, [POUDRE]: 21, [SANG]: 5, [SIOU]: 40, [TRUFFE_A]: 5, [TRUFFE_D]: 45 },
      crafts: { [ORBE]: 5, [FIBRE]: 9, [COIFFE_M]: 1, [COIFFE_L]: 1 },
      bought: [FIL],
    },
    {
      name: 'T2a Baguette Deuh Pain ×1',
      input: { targets: [{ itemId: BAGUETTE, qty: 1 }] },
      shop: t2aShop,
      crafts: { [PAIN_COMPLET]: 1, [FARINE_I]: 1, [ACIER]: 3, [MANCHE]: 5, [BAGUETTE]: 1 },
      surplus: { [PAIN_COMPLET]: 1 },
    },
    {
      name: 'T2b Baguette Deuh Pain ×2',
      input: { targets: [{ itemId: BAGUETTE, qty: 2 }] },
      shop: Object.fromEntries(Object.entries(t2aShop).map(([k, v]) => [k, v * 2])),
      crafts: { [PAIN_COMPLET]: 2, [FARINE_I]: 2, [ACIER]: 6, [MANCHE]: 10, [BAGUETTE]: 2 },
      surplus: { [PAIN_COMPLET]: 2 },
    },
    {
      name: 'T2c Pain de Farle ×10 (rendement 4)',
      input: { targets: [{ itemId: PAIN_FARLE, qty: 10 }] },
      shop: { [PAILLE_BLE]: 15, [SEAU]: 15, [TOPI]: 15 },
      crafts: { [PAIN_FARLE]: 3, [FARINE_G]: 3 },
      surplus: { [PAIN_FARLE]: 2 },
    },
    {
      name: 'T3a Orbe Durable ×3, recette par défaut R6446',
      input: { targets: [{ itemId: ORBE, qty: 3 }] },
      shop: { [ECLAT]: 3, [KRAK]: 21 },
      crafts: { [ORBE]: 3 },
    },
    {
      name: 'T3b Orbe Durable ×3, variante R7362',
      input: { targets: [{ itemId: ORBE, qty: 3 }], recipeChoice: { [ORBE]: 7362 } },
      shop: { [FIL_SERRAGE]: 3, [PAILLE_F]: 21 },
      crafts: { [ORBE]: 3 },
    },
    {
      name: 'T3c T1a avec la variante R7362 (appliquée aux deux occurrences)',
      input: coiffe({ recipeChoice: { [ORBE]: 7362 } }),
      shop: { ...t1aWithoutOrbeInputs, [FIL_SERRAGE]: 5, [PAILLE_F]: 35 },
      crafts: t1aCrafts,
    },
  ];
}

/** Résultat observé, dans la même forme que NeedsCase, avec des clés lisibles (« Krak-Ertz #1234 »). */
export function observe(index: GameIndex, c: NeedsCase) {
  const label = (id: number | string) => `${index.items.get(Number(id))?.name ?? '?'} #${id}`;
  const named = (r: Record<number, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [label(k), v]));
  const res = computeNeeds(index, c.input);
  const list = shoppingList(index, res, c.input, { missingOnly: true });
  const shop = Object.fromEntries([...list.resources, ...list.bought].map((l) => [l.itemId, l.missing]));
  const crafts = Object.fromEntries([...res.totals].filter(([, t]) => t.crafts > 0).map(([k, t]) => [k, t.crafts]));
  const surplus = Object.fromEntries([...res.leftover].filter(([k]) => (res.totals.get(k)?.crafts ?? 0) > 0));
  return {
    actual: {
      shop: named(shop),
      crafts: named(crafts),
      ...(c.surplus ? { surplus: named(surplus) } : {}),
      ...(c.bought ? { bought: list.bought.map((l) => label(l.itemId)) } : {}),
      ...(c.order ? { order: craftOrder(index, res).map((s) => label(s.itemId)) } : {}),
    },
    expected: {
      shop: named(c.shop),
      crafts: named(c.crafts),
      ...(c.surplus ? { surplus: named(c.surplus) } : {}),
      ...(c.bought ? { bought: c.bought.map(label) } : {}),
      ...(c.order ? { order: c.order.map(label) } : {}),
    },
  };
}
