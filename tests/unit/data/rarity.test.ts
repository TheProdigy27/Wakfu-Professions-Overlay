import { describe, expect, it } from 'vitest';
import { rarityColor, rarityName } from '../../../src/core/data/rarity';
import { LOCALES, messages } from '../../../src/core/i18n';

const RARITIES = [0, 1, 2, 3, 4, 5, 6, 7];

describe('rarityName', () => {
  it('nomme les 8 raretés des données', () => {
    expect(RARITIES.map((r) => rarityName(r, messages('fr')))).toEqual([
      'Ancien Objet',
      'Commun',
      'Rare',
      'Mythique',
      'Légendaire',
      'Relique',
      'Souvenir',
      'Épique',
    ]);
    expect(RARITIES.map((r) => rarityName(r, messages('en')))).toEqual([
      'Old Item',
      'Common',
      'Rare',
      'Mythical',
      'Legendary',
      'Relic',
      'Souvenir',
      'Epic',
    ]);
  });

  it('chaque langue nomme les 8 raretés', () => {
    for (const locale of LOCALES) expect(messages(locale).rarities).toHaveLength(8);
  });

  it('reste lisible pour une rareté inconnue', () => {
    expect(rarityName(8, messages('fr'))).toBe('Rareté 8');
    expect(rarityName(8, messages('es'))).toBe('Rareza 8');
  });
});

describe('rarityColor', () => {
  it('couleurs mesurées, gris pour une rareté non mesurée', () => {
    expect(rarityColor(4)).toBe('#d8ea00');
    expect(rarityColor(1)).toBe('#ffffff');
    expect(rarityColor(0)).toBe('#9a9a9a');
    expect(rarityColor(8)).toBe('#9a9a9a');
  });
});
