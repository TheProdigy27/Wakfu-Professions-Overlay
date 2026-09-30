import { describe, expect, it } from 'vitest';
import { applyChatChanges, applyChatEvents, craftedItem, createChatLookup } from '../../../src/core/chat/applyChat';
import type { ChatCraft, ChatEvent, ChatItemChange } from '../../../src/core/chat/chatLine';
import type { Names } from '../../../src/core/data/indexFile';
import { LOCALES, type Locale } from '../../../src/core/i18n/locale';
import { computeNeeds } from '../../../src/core/needs/computeNeeds';
import { hasAll, needsInput, newList, setOwned, setTargetQty, type CraftList } from '../../../src/core/state/craftList';
import { withSnapshot } from '../../../src/core/state/reconcile';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';

const { file, index } = loadFixture();
const namesById = new Map<number, Names>(file.items.map(([id, names]) => [id, names]));
const names = (id: number) => namesById.get(id);
const t0 = new Date('2026-09-27T10:00:00Z');
const t1 = new Date('2026-09-27T10:05:00Z');
const TRUFFE_DESERT = 18115;
const FAYOT = 9805;

/** Coiffe Lardante légendaire : son arbre contient la Coiffe mythique, du même nom. */
const coiffe = (): CraftList =>
  setOwned(withSnapshot(newList(IDS.COIFFE_L, index.version, {}, t0, 'liste-1'), index), IDS.POUDRE, 10, t0);
const fr = (name: string, qty: number): ChatItemChange => ({ locale: 'fr', name, qty });

describe('applyChatChanges', () => {
  it('ajoute les objets ramassés et retire les objets perdus, sans descendre sous 0', () => {
    const list = applyChatChanges(coiffe(), [fr('Fibre Durable', 7), fr('Poudre', -4)], names, t1);
    expect(list.owned).toEqual({ [IDS.POUDRE]: 6, [IDS.FIBRE]: 7 });
    expect(list.updatedAt).toBe(t1.toISOString());
    expect(applyChatChanges(list, [fr('Poudre', -20)], names).owned).toEqual({ [IDS.FIBRE]: 7 });
  });

  it('cherche le nom dans la langue du client de jeu', () => {
    const list = applyChatChanges(coiffe(), [{ locale: 'en', name: 'Durable Orb', qty: 3 }], names);
    expect(list.owned[IDS.ORBE]).toBe(3);
    // Nom anglais annoncé par un client français : aucun objet de l'arbre.
    expect(applyChatChanges(coiffe(), [fr('Durable Orb', 3)], names).owned[IDS.ORBE]).toBeUndefined();
  });

  it("ignore les objets hors de l'arbre et les noms portés par plusieurs de ses objets", () => {
    const list = coiffe();
    expect(applyChatChanges(list, [fr('Serre de Kroapule', 7), fr('Coiffe Lardante', 1)], names, t1)).toBe(list);
  });

  it('un craft : ingrédients perdus, résultat ramassé ; la case « je l\'ai » se coche seule', () => {
    let list = setOwned(setOwned(coiffe(), TRUFFE_DESERT, 5, t0), FAYOT, 5, t0);
    const demand = computeNeeds(index, needsInput(list)).totals.get(IDS.FIBRE)!.demand;
    list = applyChatChanges(list, [fr('Truffe du Désert', -5), fr('Fayot', -5), fr('Fibre Durable', 1)], names, t1);
    expect(list.owned).toEqual({ [IDS.POUDRE]: 10, [IDS.FIBRE]: 1 });
    expect(hasAll(list, IDS.FIBRE, demand)).toBe(false);
    list = applyChatChanges(list, [fr('Fibre Durable', demand - 1)], names, t1);
    expect(hasAll(list, IDS.FIBRE, demand)).toBe(true);
  });
});

const lookup = createChatLookup(index, names);

/**
 * Lignes du chat d'un craft réussi, comme les écrit le client de jeu : ingrédients perdus (recette par défaut), sauf
 * l'objet de base d'une amélioration, que le jeu transforme sans l'écrire ; objet fabriqué ramassé ; puis le craft, qui
 * reprend ces lignes.
 */
function crafting(itemId: number, crafts = 1, locale: Locale = 'fr', { withBase = false } = {}): ChatEvent[] {
  const lang = LOCALES.indexOf(locale);
  const name = (id: number) => names(id)![lang]!;
  const recipe = index.recipesByItem.get(itemId)![0]!;
  const base = recipe.isUpgrade ? recipe.ings.find((ing) => ing.qty === 1 && name(ing.itemId) === name(itemId)) : undefined;
  const items: ChatItemChange[] = [
    ...recipe.ings
      .filter((ing) => withBase || ing !== base)
      .map((ing) => ({ locale, name: name(ing.itemId), qty: -ing.qty * crafts })),
    { locale, name: name(itemId), qty: recipe.yield * crafts },
  ];
  return [...items.map((i) => ({ kind: 'item' as const, ...i })), { kind: 'craft', locale, name: name(itemId), items }];
}
const craftOf = (events: ChatEvent[]) => events.find((e) => e.kind === 'craft')!;
const list = (itemId: number, id: string, qty = 1): CraftList =>
  setTargetQty(withSnapshot(newList(itemId, index.version, {}, t0, id), index), qty, t0);

describe('craftedItem', () => {
  it('reconnaît la rareté fabriquée à ses ingrédients perdus : noms et quantités, pour un ou plusieurs crafts', () => {
    expect(craftedItem(craftOf(crafting(IDS.COIFFE_M)), lookup)).toMatchObject({
      itemId: IDS.COIFFE_M,
      qty: 1,
      match: { recipe: { id: 6518 }, crafts: 1, unlogged: [] },
    });
    expect(craftedItem(craftOf(crafting(IDS.COIFFE_M, 3)), lookup)).toMatchObject({
      itemId: IDS.COIFFE_M,
      qty: 3,
      match: { crafts: 3 },
    });
    expect(craftedItem(craftOf(crafting(IDS.COIFFE_M, 2, 'pt')), lookup)).toMatchObject({ itemId: IDS.COIFFE_M, qty: 2 });
  });

  it("amélioration : l'objet de base, que le chat n'annonce pas perdu, est consommé quand même", () => {
    expect(craftedItem(craftOf(crafting(IDS.COIFFE_L)), lookup)).toMatchObject({
      itemId: IDS.COIFFE_L,
      qty: 1,
      match: { recipe: { id: 6611 }, crafts: 1, unlogged: [{ itemId: IDS.COIFFE_M, qty: 1 }] },
    });
    expect(craftedItem(craftOf(crafting(IDS.COIFFE_L, 1, 'fr', { withBase: true })), lookup)).toMatchObject({
      itemId: IDS.COIFFE_L,
      match: { recipe: { id: 6611 }, unlogged: [] },
    });
  });

  it('objet seul à porter ce nom : reconnu même sans ses ingrédients', () => {
    const craft: ChatCraft = { locale: 'fr', name: 'Fibre Durable', items: [fr('Fibre Durable', 4)] };
    expect(craftedItem(craft, lookup)).toEqual({ itemId: IDS.FIBRE, qty: 4 });
  });

  it("homonymes sans les ingrédients d'une de leurs recettes, nom inconnu : aucun objet", () => {
    const [, ...partial] = craftOf(crafting(IDS.COIFFE_L)).items;
    expect(craftedItem({ locale: 'fr', name: 'Coiffe Lardante', items: partial }, lookup)).toBeNull();
    expect(craftedItem({ locale: 'fr', name: 'Coiffe Lardante', items: [] }, lookup)).toBeNull();
    // Quantités qui ne font pas un nombre entier de crafts.
    const odd = craftOf(crafting(IDS.COIFFE_M)).items.map((i) => (i.name === 'Poudre' ? { ...i, qty: -8 } : i));
    expect(craftedItem({ locale: 'fr', name: 'Coiffe Lardante', items: odd }, lookup)).toBeNull();
    expect(craftedItem({ locale: 'fr', name: 'Serre de Kroapule', items: [] }, lookup)).toBeNull();
  });
});

describe('applyChatEvents', () => {
  it("craft de l'objet de la liste en cours : la liste est terminée, les récents ne changent pas", () => {
    const history = [list(IDS.ORBE, 'liste-2')];
    const result = applyChatEvents(coiffe(), history, crafting(IDS.COIFFE_L), lookup, t1);
    expect(result.list).toBeNull();
    expect(result.history).toBe(history);
    expect(result.done.map((l) => [l.id, l.owned[IDS.COIFFE_L]])).toEqual([['liste-1', 1]]);
  });

  it("chaîne d'amélioration : la Coiffe mythique fabriquée entre en stock, puis la légendaire la consomme et termine la liste", () => {
    let result = applyChatEvents(coiffe(), [], crafting(IDS.COIFFE_M), lookup, t1);
    expect(result.list?.owned[IDS.COIFFE_M]).toBe(1);
    expect(result.done).toEqual([]);
    result = applyChatEvents(result.list, [], crafting(IDS.COIFFE_L), lookup, t1);
    expect(result.list).toBeNull();
    expect(result.done[0]!.owned[IDS.COIFFE_M]).toBeUndefined();
    expect(result.done[0]!.owned[IDS.COIFFE_L]).toBe(1);
  });

  it('quantité voulue pas encore atteinte : la liste reste, avec les exemplaires fabriqués en stock', () => {
    let result = applyChatEvents(setTargetQty(coiffe(), 2, t0), [], crafting(IDS.COIFFE_L), lookup, t1);
    expect(result.list?.owned[IDS.COIFFE_L]).toBe(1);
    expect(result.done).toEqual([]);
    result = applyChatEvents(result.list, [], crafting(IDS.COIFFE_L), lookup, t1);
    expect(result.list).toBeNull();
    expect(result.done).toHaveLength(1);
  });

  it('listes des récents : retirées quand le craft en donne la quantité voulue, même sans liste en cours', () => {
    const nine = list(IDS.FIBRE, 'fibre-9', 9);
    const twenty = list(IDS.FIBRE, 'fibre-20', 20);
    const other = list(IDS.ORBE, 'orbe');
    const result = applyChatEvents(null, [nine, other, twenty], crafting(IDS.FIBRE, 9), lookup, t1);
    expect(result.list).toBeNull();
    expect(result.history).toEqual([other, twenty]);
    expect(result.done).toEqual([nine]);
  });

  it("autre rareté d'un objet de l'arbre fabriquée : pas comptée pour lui, et la liste reste", () => {
    // Coiffe mythique ×2, dont une déjà faite, améliorée ensuite en légendaire : celle-ci n'est pas dans son arbre.
    const mythic = setOwned(list(IDS.COIFFE_M, 'mythique', 2), IDS.COIFFE_M, 1, t0);
    const result = applyChatEvents(mythic, [], crafting(IDS.COIFFE_L), lookup, t1);
    expect(result.done).toEqual([]);
    expect(result.list?.owned[IDS.COIFFE_M]).toBeUndefined();
  });

  it('craft non reconnu, objets hors des listes : rien ne change', () => {
    const current = coiffe();
    const history = [list(IDS.ORBE, 'liste-2')];
    const events: ChatEvent[] = [
      { kind: 'item', ...fr('Serre de Kroapule', 7) },
      { kind: 'craft', locale: 'fr', name: 'Coiffe Lardante', items: [fr('Coiffe Lardante', 1)] },
      { kind: 'craft', locale: 'fr', name: 'Serre de Kroapule', items: [] },
    ];
    const result = applyChatEvents(current, history, events, lookup, t1);
    expect(result.list).toBe(current);
    expect(result.history).toBe(history);
    expect(result.done).toEqual([]);
  });
});
