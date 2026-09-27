import { describe, expect, it } from 'vitest';
import { rarityColor, rarityName } from '../../../src/core/data/rarity';

describe('rarityName', () => {
  it('nomme les 8 raretés des données', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(rarityName)).toEqual([
      'Ancien Objet',
      'Commun',
      'Rare',
      'Mythique',
      'Légendaire',
      'Relique',
      'Souvenir',
      'Épique',
    ]);
  });

  it('reste lisible pour une rareté inconnue', () => {
    expect(rarityName(8)).toBe('Rareté 8');
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
