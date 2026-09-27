// Icône et nom d'un objet, en couleur de rareté.
import { useState } from 'react';
import type { GameIndex, Item } from '../../../core/data/loadIndex';
import { rarityColor, rarityName } from '../../../core/data/rarity';
import type { Messages } from '../../../core/i18n';
import { useMessages } from '../store';

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
  const m = useMessages();
  if (!item) return <span className="item-name unknown">{m.common.unknownItem(itemId)}</span>;
  return (
    <span className="item-name" style={{ color: rarityColor(item.rarity) }} title={m.item.tooltip(rarityName(item.rarity, m), item.level)}>
      {item.name}
    </span>
  );
}

/** « Niv. 125 · Légendaire · Casque » */
export function itemMeta(index: GameIndex, item: Item, m: Messages): string {
  const type = index.types.get(item.typeId);
  return [m.item.level(item.level), rarityName(item.rarity, m), type].filter(Boolean).join(' · ');
}
