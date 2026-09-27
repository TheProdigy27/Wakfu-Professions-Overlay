import { describe, expect, it } from 'vitest';
import { computeNeeds } from '../../../src/core/needs/computeNeeds';
import { shoppingList, shoppingText } from '../../../src/core/needs/shopping';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';

const { index } = loadFixture();

describe('shoppingText', () => {
  it('liste ce qui reste à obtenir, par section', () => {
    const input = { targets: [{ itemId: IDS.COIFFE_L, qty: 1 }], owned: { [IDS.POUDRE]: 21 }, mode: { [IDS.FIL]: 'buy' as const } };
    const list = shoppingList(index, computeNeeds(index, input), input, { missingOnly: true });
    expect(shoppingText(index, 'Coiffe Lardante (Légendaire) ×1', list)).toBe(
      [
        'Coiffe Lardante (Légendaire) ×1 : liste de courses',
        '',
        'Ressources',
        '- Eclat de Taroudium ×5',
        '- Fayot ×45',
        '- Krak-Ertz ×35',
        '- Sang du Dragon-Cochon ×5',
        '- Sioupère-Glou Durable ×40',
        '- Truffe Aromatisée ×5',
        '- Truffe du Désert ×45',
        '',
        'Intermédiaires achetés',
        '- Fil Durable ×14',
      ].join('\n'),
    );
  });

  it('sans rien à obtenir, ou avec un objet inconnu', () => {
    expect(shoppingText(index, 'X ×1', { resources: [], bought: [] })).toBe('X ×1 : liste de courses\n\nRien ne manque.');
    const lines = { resources: [{ itemId: 999999, required: 2, owned: 0, missing: 2 }, { itemId: IDS.POUDRE, required: 1, owned: 1, missing: 0 }], bought: [] };
    expect(shoppingText(index, 'X ×1', lines)).toBe('X ×1 : liste de courses\n\nRessources\n- Objet inconnu #999999 ×2');
  });
});
