// Icône et nom d'un objet, en couleur de rareté ; copie du nom ; provenance des ressources récoltées ; plan requis par une recette.
import { useEffect, useState } from 'react';
import type { GameIndex, Item, Recipe } from '../../../core/data/loadIndex';
import { rarityColor, rarityName } from '../../../core/data/rarity';
import type { Messages } from '../../../core/i18n';
import { harvestLabel } from '../../../core/needs/shopping';
import { useMessages } from '../store';
import { Glyph } from './Glyph';

export function ItemIcon({ item }: { item: Item | undefined }) {
  // gfxId en échec (icône absente ou réseau indisponible) : image de remplacement.
  const [failed, setFailed] = useState<number>();
  if (!item || failed === item.gfxId) return <span className="icon icon-missing" aria-hidden="true" />;
  // lazy : dans les longues listes (crafts par métier), seules les icônes proches de l'écran sont téléchargées.
  return (
    <img
      className="icon"
      src={`wicon://item/${item.gfxId}`}
      alt=""
      loading="lazy"
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

/** Vrai pendant 1,5 s après une copie dans le presse-papiers, le temps de montrer qu'elle a eu lieu. */
export function useCopied(): [copied: boolean, markCopied: () => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return [copied, () => setCopied(true)];
}

/** Copie le nom de l'objet, à coller dans une recherche du jeu (Hôtel de vente, fenêtre de craft…). */
export function CopyName({ item }: { item: Item | undefined }) {
  const m = useMessages();
  const [copied, markCopied] = useCopied();
  if (!item) return null;
  const label = copied ? m.item.nameCopied : m.item.copyName;
  return (
    <button
      type="button"
      className={copied ? 'copy-name copied' : 'copy-name'}
      title={label}
      aria-label={label}
      onClick={() => {
        window.api.copyText(item.name);
        markCopied();
      }}
    >
      <Glyph name={copied ? 'check' : 'copy'} />
    </button>
  );
}

/** Provenance d'une ressource récoltée (« Mineur niv. 15 »), en gris ; rien pour les autres objets. */
export function HarvestSource({ index, itemId }: { index: GameIndex; itemId: number }) {
  const m = useMessages();
  const label = harvestLabel(index, itemId, m);
  if (!label) return null;
  return (
    <span className="source" title={m.item.harvestTitle}>
      {label}
    </span>
  );
}

/** « Nécessite : Plan "Kokordon" » */
export function planLabel(index: GameIndex, planId: number, m: Messages): string {
  return m.item.needsPlan(index.items.get(planId)?.name ?? m.common.unknownItem(planId));
}

/** Plan à apprendre avant de crafter cette recette ; rien si la recette est connue d'emblée. */
export function PlanNeeded({ index, recipe }: { index: GameIndex; recipe: Recipe }) {
  const m = useMessages();
  if (recipe.plan === undefined) return null;
  return (
    <span className="plan" title={m.item.planTitle}>
      {planLabel(index, recipe.plan, m)}
    </span>
  );
}

/** « Niv. 125 · Légendaire · Casque » */
export function itemMeta(index: GameIndex, item: Item, m: Messages): string {
  const type = index.types.get(item.typeId);
  return [m.item.level(item.level), rarityName(item.rarity, m), type].filter(Boolean).join(' · ');
}
