import { describe, expect, it } from 'vitest';
import { en } from '../../../src/core/i18n/en';
import { fr } from '../../../src/core/i18n/fr';
import { computeNeeds } from '../../../src/core/needs/computeNeeds';
import { shoppingList, shoppingText } from '../../../src/core/needs/shopping';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';

const { index } = loadFixture();
const input = { targets: [{ itemId: IDS.COIFFE_L, qty: 1 }], owned: { [IDS.POUDRE]: 21 }, mode: { [IDS.FIL]: 'buy' as const } };

describe('shoppingText', () => {
  it('liste ce qui reste à obtenir, par section, avec la provenance des ressources récoltées', () => {
    const list = shoppingList(index, computeNeeds(index, input), input, { missingOnly: true });
    expect(shoppingText(index, 'Coiffe Lardante (Légendaire) ×1', list, fr)).toBe(
      [
        'Coiffe Lardante (Légendaire) ×1 : liste de courses',
        '',
        'Ressources',
        '- Eclat de Taroudium ×5',
        '- Fayot ×45 (Paysan niv. 70)',
        '- Krak-Ertz ×35',
        '- Sang du Dragon-Cochon ×5',
        '- Sioupère-Glou Durable ×40',
        '- Truffe Aromatisée ×5 (Paysan niv. 75)',
        '- Truffe du Désert ×45 (Paysan niv. 75)',
        '',
        'Intermédiaires achetés',
        '- Fil Durable ×14',
      ].join('\n'),
    );
  });

  it('en anglais : noms et sections dans cette langue, triés dans cette langue', () => {
    const idx = loadFixture('en').index;
    const list = shoppingList(idx, computeNeeds(idx, input), input, { missingOnly: true });
    const text = shoppingText(idx, 'Larduous Hat (Legendary) ×1', list, en).split('\n');
    expect(text.slice(0, 3)).toEqual(['Larduous Hat (Legendary) ×1: shopping list', '', 'Resources']);
    const resources = text.slice(3, text.indexOf('', 3));
    expect(resources).toHaveLength(7);
    expect(resources).toContain('- Krak-Ertz ×35');
    expect(resources).toEqual([...resources].sort((a, b) => a.localeCompare(b, 'en')));
    expect(text.slice(-2)).toEqual(['Bought intermediates', '- Durable String ×14']);
  });

  it('sans rien à obtenir, ou avec un objet inconnu', () => {
    expect(shoppingText(index, 'X ×1', { resources: [], bought: [] }, fr)).toBe('X ×1 : liste de courses\n\nRien ne manque.');
    const lines = { resources: [{ itemId: 999999, required: 2, owned: 0, missing: 2 }, { itemId: IDS.POUDRE, required: 1, owned: 1, missing: 0 }], bought: [] };
    expect(shoppingText(index, 'X ×1', lines, fr)).toBe('X ×1 : liste de courses\n\nRessources\n- Objet inconnu #999999 ×2');
    expect(shoppingText(index, 'X ×1', lines, en)).toBe('X ×1: shopping list\n\nResources\n- Unknown item #999999 ×2');
  });
});
