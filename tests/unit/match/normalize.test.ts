import { describe, expect, it } from 'vitest';
import { normalize } from '../../../src/core/match/normalize';

describe('normalize', () => {
  it('minuscules, sans accents, œ développé, espaces fusionnés', () => {
    expect(normalize('  COIFFE   Lardante ')).toBe('coiffe lardante');
    expect(normalize('Épée Éternelle')).toBe('epee eternelle');
    expect(normalize('Cœur de Bœuf')).toBe('coeur de boeuf');
    expect(normalize('Chevalière nécromique')).toBe('chevaliere necromique');
  });

  it('unifie apostrophes, guillemets et tirets typographiques', () => {
    expect(normalize('Caissette d’Enchantement')).toBe("caissette d'enchantement");
    expect(normalize('Anneau de !@#dh`~')).toBe("anneau de !@#dh'~");
    expect(normalize('«Wé»')).toBe('"we"');
    expect(normalize('Se–Rat—Hête')).toBe('se-rat-hete');
  });

  it('conserve la ponctuation : les noms qui en sont faits ne sont ni vides ni réduits à une lettre', () => {
    expect(normalize('!"(-è@)"')).toBe('!"(-e@)"');
    expect(normalize('".#@)é')).toBe('".#@)e');
  });
});
