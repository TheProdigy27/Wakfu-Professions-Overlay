import { describe, expect, it } from 'vitest';
import { applyChatChanges } from '../../../src/core/chat/applyChat';
import type { ChatItemChange } from '../../../src/core/chat/chatLine';
import type { Names } from '../../../src/core/data/indexFile';
import { computeNeeds } from '../../../src/core/needs/computeNeeds';
import { hasAll, needsInput, newList, setOwned, type CraftList } from '../../../src/core/state/craftList';
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
