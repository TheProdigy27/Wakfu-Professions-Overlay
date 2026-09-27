// Noms et couleurs des raretés. Les noms, absents des données du jeu, sont dans les traductions (Messages.rarities) :
// confirmés sur des captures du jeu en français, sauf la rareté 0 (73 objets en 1.93.1.62, surtout des bases
// d'amélioration vers Rare, absents de l'encyclopédie), nommée de mémoire par un joueur.
import type { Messages } from '../i18n';

/** Nom affiché d'une rareté ; une rareté ajoutée par une future version du jeu reste lisible. */
export function rarityName(rarity: number, m: Messages): string {
  return m.rarities[rarity] ?? m.unknownRarity(rarity);
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
