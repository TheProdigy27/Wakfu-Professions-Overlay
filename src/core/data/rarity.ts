// Noms des raretés, confirmés sur des captures du jeu, sauf la rareté 0.
export const RARITY_NAMES: Readonly<Record<number, string>> = {
  // Rareté 0 : 73 objets en 1.93.1.62, surtout des bases d'amélioration vers Rare, absents de l'encyclopédie du jeu.
  // Nom donné de mémoire par un joueur, non vérifié en jeu.
  0: 'Ancien Objet',
  1: 'Commun',
  2: 'Rare',
  3: 'Mythique',
  4: 'Légendaire',
  5: 'Relique',
  6: 'Souvenir',
  7: 'Épique',
};

/** Nom affiché d'une rareté ; une rareté ajoutée par une future version du jeu reste lisible. */
export function rarityName(rarity: number): string {
  return RARITY_NAMES[rarity] ?? `Rareté ${rarity}`;
}

/** Couleur du nom dans l'interface du jeu : RGB médian mesuré sur des captures du jeu. */
export const RARITY_COLORS: Readonly<Record<number, string>> = {
  1: '#ffffff',
  2: '#12ff89',
  3: '#e27a00',
  4: '#d8ea00',
  5: '#a35eff',
  6: '#16aaff',
  7: '#ff5ebc',
};

/** Rareté 0 (non mesurée) ou inconnue : gris neutre. */
export function rarityColor(rarity: number): string {
  return RARITY_COLORS[rarity] ?? '#9a9a9a';
}
