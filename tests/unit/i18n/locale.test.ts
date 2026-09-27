import { describe, expect, it } from 'vitest';
import { isLocale, LOCALE_NAMES, LOCALES, matchLocale, messages } from '../../../src/core/i18n';

describe('matchLocale', () => {
  it('première langue de Windows traduite, région ignorée', () => {
    expect(matchLocale(['fr-FR', 'en-US'])).toBe('fr');
    expect(matchLocale(['pt-BR'])).toBe('pt');
    expect(matchLocale(['pt-PT'])).toBe('pt');
    expect(matchLocale(['es-419'])).toBe('es');
    expect(matchLocale(['de-DE', 'es-ES', 'fr-FR'])).toBe('es');
    expect(matchLocale(['FR_ca'])).toBe('fr');
  });

  it("l'anglais pour une langue non traduite", () => {
    expect(matchLocale(['de-DE', 'it-IT'])).toBe('en');
    expect(matchLocale([])).toBe('en');
  });
});

describe('langues', () => {
  it('chacune a un nom et des textes', () => {
    for (const locale of LOCALES) {
      expect(isLocale(locale)).toBe(true);
      expect(LOCALE_NAMES[locale]).toBeTruthy();
      expect(messages(locale).settings.language).toBeTruthy();
    }
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('chaque texte de chaque langue existe, non vide, et se construit sans erreur', () => {
    // Chemin → texte produit ; une fonction reçoit des arguments ['1'] qui conviennent à tous les types attendus.
    const texts = (value: unknown, path = ''): [string, unknown][] => {
      if (typeof value === 'function') return [[path, value(...Array.from({ length: value.length }, () => ['1']))]];
      if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => texts(v, `${path}.${k}`));
      return [[path, value]];
    };
    const reference = texts(messages('fr')).map(([path]) => path);
    for (const locale of LOCALES) {
      const all = texts(messages(locale));
      expect(all.map(([path]) => path)).toEqual(reference);
      for (const [path, text] of all) {
        const strings = Array.isArray(text) ? text.flat() : [text];
        for (const s of strings) expect(typeof s === 'string' && s.trim() !== '', `${locale}${path}`).toBe(true);
      }
    }
  });

  it('les traductions ne recopient pas le français', () => {
    // Quelques textes témoins : une section oubliée garderait le texte français.
    const fr = messages('fr');
    for (const locale of ['en', 'es', 'pt'] as const) {
      const m = messages(locale);
      expect(m.search.placeholder).not.toBe(fr.search.placeholder);
      expect(m.onboarding.tips('X')[0]![1]).not.toBe(fr.onboarding.tips('X')[0]![1]);
      expect(m.tray.quit).not.toBe(fr.tray.quit);
      expect(m.data.errors.format('1.0')).not.toBe(fr.data.errors.format('1.0'));
    }
  });
});
