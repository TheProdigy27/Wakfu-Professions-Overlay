// Icône et nom d'un objet, en couleur de rareté.
import { useState } from 'react';
import type { GameIndex, Item } from '../../../core/data/loadIndex';
import { rarityColor, rarityName } from '../../../core/data/rarity';

export function ItemIcon({ item }: { item: Item | undefined }) {
  // gfxId en échec (icône absente ou réseau indisponible) : image de remplacement.
  const [failed, setFailed] = useState<number>();
  if (!item || failed === item.gfxId) return <span className="icon icon-missing" aria-hidden="true" />;
  return (
    <img
      className="icon"
      src={`wicon://item/${item.gfxId}`}
      alt=""
      draggable={false}
      onError={() => setFailed(item.gfxId)}
    />
  );
}

export function ItemName({ item, itemId }: { item: Item | undefined; itemId: number }) {
  if (!item) return <span className="item-name unknown">Objet inconnu #{itemId}</span>;
  return (
    <span className="item-name" style={{ color: rarityColor(item.rarity) }} title={`${rarityName(item.rarity)}, niv. ${item.level}`}>
      {item.name}
    </span>
  );
}

/** « Niv. 125 · Légendaire · Casque » */
export function itemMeta(index: GameIndex, item: Item): string {
  const type = index.types.get(item.typeId);
  return [`Niv. ${item.level}`, rarityName(item.rarity), type].filter(Boolean).join(' · ');
}
