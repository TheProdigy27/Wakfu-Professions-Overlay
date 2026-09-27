import { describe, expect, it } from 'vitest';
import { migrate, NewerStateError, parseState, stateVersion, type Migration } from '../../../src/core/state/migrations';
import { defaultState, PersistedStateSchema, STATE_SCHEMA_VERSION } from '../../../src/core/state/schema';
import { readStateV1, readStateV2, readStateV3, readStateV4, readStateV5 } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';

describe('state.json', () => {
  it('la fixture v1 migrée vers le format courant passe la validation zod', () => {
    const state = parseState(readStateV1());
    expect(state.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(state.current?.target).toEqual({ itemId: IDS.COIFFE_L, qty: 1 });
    expect(state.current?.owned).toEqual({ [IDS.POUDRE]: 10 });
    expect(state.current?.mode).toEqual({ [IDS.FIL]: 'buy' });
    expect(state.history.map((l) => l.target.itemId)).toEqual([IDS.ORBE, IDS.BAGUETTE]);
    expect(state.recipePrefs).toEqual({ [IDS.ORBE]: 7362 });
    expect(state.settings.hotkeys.toggle).toBe('CommandOrControl+Alt+Shift+K');
    expect(state.window.normal).toEqual({ x: 1476, y: 24, width: 420, height: 640 });
    // Format 2 : langue de Windows tant qu'on n'en a pas choisi une.
    expect(state.settings.language).toBeNull();
    // Format 3 : panneau pas affiché avec Wakfu.
    expect(state.settings.showWithWakfu).toBe(false);
    // Format 4 : aucun niveau de métier indiqué.
    expect(state.jobLevels).toEqual({});
    // Format 5 : quantités pas mises à jour avec le chat de Wakfu.
    expect(state.settings.ownedFromChat).toBe(false);
  });

  it('la fixture v2 migrée garde la langue choisie', () => {
    const state = parseState(readStateV2());
    expect(state.settings.language).toBe('en');
    expect(state.settings.showWithWakfu).toBe(false);
    expect(state).toEqual({ ...parseState(readStateV1()), settings: { ...state.settings } });
  });

  it('la fixture v3 migrée garde l\'affichage avec Wakfu', () => {
    const state = parseState(readStateV3());
    expect(state.settings).toMatchObject({ language: 'en', launchAtLogin: true, showWithWakfu: true });
    expect(state).toEqual({ ...parseState(readStateV2()), settings: { ...state.settings } });
  });

  it('la fixture v4 migrée garde les niveaux de métier', () => {
    const state = parseState(readStateV4());
    expect(state.jobLevels).toEqual({ 79: 125, 81: 60 });
    expect(state.settings.ownedFromChat).toBe(false);
    expect(state).toEqual({ ...parseState(readStateV3()), jobLevels: state.jobLevels });
  });

  it('la fixture v5 est au format courant, quantités mises à jour avec le chat', () => {
    const state = parseState(readStateV5());
    expect(state).toEqual(readStateV5());
    expect(state.settings.ownedFromChat).toBe(true);
    expect(state).toEqual({ ...parseState(readStateV4()), settings: { ...state.settings } });
  });

  it("l'état par défaut est valide", () => {
    expect(PersistedStateSchema.parse(defaultState())).toEqual(defaultState());
  });

  it('refuse un état invalide', () => {
    const bad = (patch: (s: ReturnType<typeof defaultState>) => void) => {
      const s = structuredClone(readStateV1()) as ReturnType<typeof defaultState>;
      patch(s);
      return () => parseState(s);
    };
    expect(bad((s) => (s.settings.opacity = 0.1))).toThrow();
    expect(() => parseState({ ...(readStateV5() as object), settings: { ...defaultState().settings, language: 'de' } })).toThrow();
    expect(() => parseState({ ...(readStateV5() as object), jobLevels: { 79: -1 } })).toThrow();
    expect(() => parseState({ ...(readStateV5() as object), jobLevels: { tailleur: 125 } })).toThrow();
    expect(bad((s) => (s.current!.target.qty = 0))).toThrow();
    expect(bad((s) => ((s.current!.mode as Record<string, string>)['1'] = 'craft'))).toThrow();
    expect(bad((s) => ((s.current!.owned as Record<string, number>)['abc'] = 1))).toThrow();
    expect(bad((s) => (s.history = Array.from({ length: 11 }, () => s.current!)))).toThrow();
    expect(() => parseState({ schemaVersion: 1 })).toThrow();
    expect(() => parseState(null)).toThrow(/schemaVersion/);
  });
});

describe('migrate', () => {
  it('applique les migrations dans l\'ordre, jusqu\'au format demandé', () => {
    const steps: Record<number, Migration> = {
      1: (s) => ({ ...s, a: 'ajouté en 2' }),
      2: (s) => ({ ...s, b: `${String(s['a'])}, puis en 3` }),
    };
    expect(migrate({ schemaVersion: 1, x: 1 }, 3, steps)).toEqual({
      schemaVersion: 3,
      x: 1,
      a: 'ajouté en 2',
      b: 'ajouté en 2, puis en 3',
    });
    expect(migrate({ schemaVersion: 2 }, 3, steps)).toEqual({ schemaVersion: 3, b: 'undefined, puis en 3' });
  });

  it('signale une migration manquante ou un fichier trop récent', () => {
    expect(() => migrate({ schemaVersion: 1 }, 2, {})).toThrow('migration de state.json 1 → 2 absente');
    expect(() => migrate({ schemaVersion: 4 }, 3, {})).toThrow(NewerStateError);
  });

  it('lit le numéro de format', () => {
    expect(stateVersion({ schemaVersion: 3 })).toBe(3);
    for (const json of [null, 'texte', {}, { schemaVersion: '1' }, { schemaVersion: -1 }, { schemaVersion: 1.5 }]) {
      expect(stateVersion(json)).toBeNull();
    }
  });
});
