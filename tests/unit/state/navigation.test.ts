import { describe, expect, it } from 'vitest';
import { MAX_HISTORY, newList, setOwned, setView, type CraftList } from '../../../src/core/state/craftList';
import { listsAfterBack, MAX_BACK, pushScreen, type Screen } from '../../../src/core/state/navigation';
import { IDS } from '../../helpers/needsCases';

const t0 = new Date('2026-09-27T10:00:00Z');
const t1 = new Date('2026-09-27T10:05:00Z');
const list = (id: string, itemId: number = IDS.COIFFE_L): CraftList => newList(itemId, '1.93.1.62', {}, t0, id);
const ids = (lists: readonly (CraftList | null)[]) => lists.map((l) => l?.id ?? null);

describe('pushScreen', () => {
  it('retient les écrans quittés, sans doublon consécutif, au plus MAX_BACK', () => {
    const a: Screen = { jobs: false, listId: 'a' };
    const b: Screen = { jobs: true, listId: 'a' };
    expect(pushScreen([a], { ...a })).toEqual([a]);
    expect(pushScreen([a], b)).toEqual([a, b]);
    expect(pushScreen([a, b], a)).toEqual([a, b, a]);
    const full = Array.from({ length: MAX_BACK }, (_, i): Screen => ({ jobs: false, listId: String(i) }));
    const next = pushScreen(full, b);
    expect(next).toHaveLength(MAX_BACK);
    expect(next[0]).toEqual({ jobs: false, listId: '1' });
    expect(next.at(-1)).toEqual(b);
  });
});

describe('listsAfterBack', () => {
  it("objet ouvert par mégarde puis retour : la liste d'avant revient, l'autre disparaît sans passer dans l'historique", () => {
    const before = list('avant');
    const oops = setView(list('mégarde', IDS.ORBE), 'order');
    const other = list('autre');
    const after = listsAfterBack(oops, [before, other], 'avant');
    expect(after.current).toBe(before);
    expect(ids(after.history)).toEqual(['autre']);
  });

  it("liste modifiée depuis : elle passe en tête de l'historique", () => {
    const before = list('avant');
    const used = setOwned(list('utilisée', IDS.ORBE), IDS.POUDRE, 3, t1);
    const after = listsAfterBack(used, [before, list('autre')], 'avant');
    expect(after.current).toBe(before);
    expect(ids(after.history)).toEqual(['utilisée', 'autre']);
    // Historique plein : la plus ancienne sort.
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => list(`h${i}`));
    const back = listsAfterBack(used, full, 'h3');
    expect(back.history).toHaveLength(MAX_HISTORY);
    expect(ids(back.history)[0]).toBe('utilisée');
    expect(ids(back.history)).not.toContain('h3');
  });

  it('retour avant la première liste : plus de liste en cours', () => {
    const oops = list('mégarde');
    expect(listsAfterBack(oops, [], null)).toEqual({ current: null, history: [] });
    const used = setOwned(oops, IDS.POUDRE, 1, t1);
    expect(listsAfterBack(used, [], null)).toEqual({ current: null, history: [used] });
  });

  it('même liste, ou liste retirée de l\'historique entre-temps : rien ne change', () => {
    const current = list('en-cours');
    const history = [list('autre')];
    expect(listsAfterBack(current, history, 'en-cours')).toEqual({ current, history });
    expect(listsAfterBack(current, history, 'retirée')).toEqual({ current, history });
    expect(listsAfterBack(null, history, null)).toEqual({ current: null, history });
  });
});
