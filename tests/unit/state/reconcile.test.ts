import { describe, expect, it } from 'vitest';
import { describeChange } from '../../../src/core/data/diffIndex';
import { fr } from '../../../src/core/i18n/fr';
import { computeNeeds } from '../../../src/core/needs/computeNeeds';
import { needsInput, setOwned, setTargetQty, type CraftList } from '../../../src/core/state/craftList';
import { parseState } from '../../../src/core/state/migrations';
import { isObsolete, reconcile, snapshotFor, withSnapshot, type Reconciled } from '../../../src/core/state/reconcile';
import { loadFixture, loadFixtureV2, readStateV1, V2 } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';

const v1 = loadFixture().index;
const v2 = loadFixtureV2().index;
const saved = parseState(readStateV1());
const [orbeList, baguetteList] = saved.history as [CraftList, CraftList];
const krak = [...v1.items.values()].find((i) => i.name === 'Krak-Ertz')!.id;
/** Texte du bandeau pour chaque recette modifiée. */
const notices = (r: Reconciled) => r.changes.map((change) => describeChange(change, v2, fr));
const toObtain = (list: CraftList, index: typeof v1, itemId: number) =>
  computeNeeds(index, needsInput(list)).totals.get(itemId)?.toObtain;

describe('snapshot', () => {
  it('couvre tout l\'arbre, quels que soient le stock, les achats et la quantité', () => {
    const list = saved.current!;
    expect(Object.keys(snapshotFor(v1, list)).map(Number).sort()).toEqual(
      [IDS.COIFFE_M, IDS.FIBRE, IDS.FIL, IDS.ORBE, IDS.COIFFE_L].sort(),
    );
    expect(snapshotFor(v1, setTargetQty(setOwned(list, IDS.COIFFE_M, 1), 5))).toEqual(snapshotFor(v1, list));
  });

  it('withSnapshot ne recrée pas la liste quand rien ne change', () => {
    const list = saved.current!;
    expect(withSnapshot(list, v1)).toBe(list);
    const stale = { ...list, snapshot: {} };
    expect(withSnapshot(stale, v1).snapshot).toEqual(list.snapshot);
  });
});

describe('reconcile, fixture « v2 modifiée »', () => {
  it('même version : rien à signaler', () => {
    const r = reconcile(saved.current!, v1);
    expect(r).toEqual({ list: saved.current, changes: [], obsolete: false });
  });

  it('recette modifiée : notice détaillée, recalcul avec les nouvelles données, stock et achats conservés', () => {
    const list = saved.current!;
    expect(toObtain(list, v1, krak)).toBe(35);
    const r = reconcile(list, v2);
    expect(notices(r)).toEqual(['Orbe Durable : Krak-Ertz 7 → 8']);
    expect(r.obsolete).toBe(false);
    expect(r.list.gameVersion).toBe(V2);
    expect(r.list.owned).toBe(list.owned);
    expect(r.list.mode).toBe(list.mode);
    expect(r.list.snapshot[IDS.ORBE]!.ings).toEqual([15862, 1, krak, 8]);
    expect(toObtain(r.list, v2, krak)).toBe(40);
    // Une fois rapprochée, la liste ne produit plus de notice.
    expect(reconcile(r.list, v2).changes).toEqual([]);
  });

  it('variante choisie disparue : retour à la recette par défaut, avec une notice', () => {
    expect(orbeList.recipeChoice).toEqual({ [IDS.ORBE]: 7362 });
    const r = reconcile(orbeList, v2);
    expect(notices(r)).toEqual(["Orbe Durable : la recette choisie n'existe plus, recette par défaut utilisée"]);
    expect(r.list.recipeChoice).toEqual({});
    expect(r.list.snapshot[IDS.ORBE]!.recipeId).toBe(6446);
    expect(toObtain(r.list, v2, krak)).toBe(24);
  });

  it('objet cible disparu : liste obsolète, laissée telle quelle', () => {
    expect(isObsolete(baguetteList, v1)).toBe(false);
    const r = reconcile(baguetteList, v2);
    expect(r).toEqual({ list: baguetteList, changes: [], obsolete: true });
  });

  it('les variantes invalides hors de l\'arbre sont retirées sans notice, les valides gardées', () => {
    // 999999 : objet inconnu ; R6446 produit l'Orbe Durable, pas lui. R2047 : Pain de Farle, hors de l'arbre, valide.
    const list = { ...saved.current!, recipeChoice: { 999999: 6446, [IDS.PAIN_FARLE]: 2047 } };
    const r = reconcile(list, v2);
    expect(r.list.recipeChoice).toEqual({ [IDS.PAIN_FARLE]: 2047 });
    expect(notices(r)).toEqual(['Orbe Durable : Krak-Ertz 7 → 8']);
  });
});
