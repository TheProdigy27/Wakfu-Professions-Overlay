// Liste de courses : ressources et intermédiaires achetés, avec requis, possédé, reste et prix de l'HDV.
import { useEffect, useState } from 'react';
import { rarityName } from '../../../core/data/rarity';
import type { NeedsResult } from '../../../core/needs/computeNeeds';
import { shoppingList, shoppingText, type ShoppingLine } from '../../../core/needs/shopping';
import { hasAll, needsInput, setMissingOnly, setOwned, toggleHave, type CraftList } from '../../../core/state/craftList';
import { updateList, useMessages, type Catalog } from '../store';
import { HarvestSource, ItemIcon, ItemName } from './Item';
import { PriceInput } from './Price';

interface ShoppingProps {
  catalog: Catalog;
  list: CraftList;
  result: NeedsResult;
  /** Mode compact : seulement ce qui manque, avec la case et le reste, sans filtre ni en-têtes. */
  compact?: boolean;
}

export function ShoppingList({ catalog, list, result, compact = false }: ShoppingProps) {
  const m = useMessages();
  const t = m.shopping;
  const missingOnly = compact || list.ui.missingOnly;
  const { resources, bought } = shoppingList(catalog.index, result, needsInput(list), { missingOnly });
  const empty = resources.length === 0 && bought.length === 0;

  return (
    <div className="shopping">
      {!compact && (
        <div className="shopping-tools">
          <label className="filter">
            <input type="checkbox" checked={list.ui.missingOnly} onChange={(e) => updateList((l) => setMissingOnly(l, e.target.checked))} />
            {t.missingOnly}
          </label>
          <CopyButton catalog={catalog} list={list} result={result} />
        </div>
      )}
      {empty && <p className="empty">{missingOnly ? t.nothingMissing : t.nothingToGet}</p>}
      {resources.length > 0 && <Section title={t.resources} lines={resources} catalog={catalog} list={list} compact={compact} />}
      {bought.length > 0 && <Section title={t.bought} lines={bought} catalog={catalog} list={list} compact={compact} />}
    </div>
  );
}

/** Copie ce qui reste à obtenir, en texte, dans le presse-papiers (pour une note, un message…). */
function CopyButton({ catalog, list, result }: { catalog: Catalog; list: CraftList; result: NeedsResult }) {
  const m = useMessages();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    const target = catalog.index.items.get(list.target.itemId);
    const name = target ? `${target.name} (${rarityName(target.rarity, m)})` : m.common.unknownItem(list.target.itemId);
    const lines = shoppingList(catalog.index, result, needsInput(list), { missingOnly: true });
    window.api.copyText(shoppingText(catalog.index, `${name} ×${list.target.qty}`, lines, m));
    setCopied(true);
  };

  return (
    <button type="button" className="copy" title={m.shopping.copyTitle} onClick={copy}>
      {copied ? m.shopping.copied : m.shopping.copy}
    </button>
  );
}

function Section(props: { title: string; lines: ShoppingLine[]; catalog: Catalog; list: CraftList; compact: boolean }) {
  const { title, lines, catalog, list, compact } = props;
  const m = useMessages();
  const t = m.shopping;
  return (
    <section>
      {!compact && <h3>{title}</h3>}
      <table className="shop-table">
        {!compact && (
          <thead>
            <tr>
              <th />
              <th className="name-col">{t.columns.item}</th>
              <th>{t.columns.required}</th>
              <th>{t.columns.owned}</th>
              <th>{t.columns.missing}</th>
              <th title={m.cost.columnTitle}>{m.cost.column}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {lines.map((line) => {
            const item = catalog.index.items.get(line.itemId);
            return (
              <tr key={line.itemId} className={line.missing === 0 ? 'done' : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={hasAll(list, line.itemId, line.required)}
                    title={t.have(line.required)}
                    onChange={() => updateList((l) => toggleHave(l, line.itemId, line.required))}
                  />
                </td>
                <td className="name-col">
                  <ItemIcon item={item} />
                  <span className="name-source">
                    <ItemName item={item} itemId={line.itemId} />
                    <HarvestSource index={catalog.index} itemId={line.itemId} />
                  </span>
                </td>
                {!compact && <td className="num">{line.required}</td>}
                {!compact && (
                  <td className="num">
                    <input
                      type="number"
                      className="owned"
                      min={0}
                      max={9999}
                      placeholder="0"
                      value={line.owned || ''}
                      aria-label={t.ownedLabel}
                      onChange={(e) => updateList((l) => setOwned(l, line.itemId, Number(e.target.value)))}
                    />
                  </td>
                )}
                <td className="num missing" title={compact ? t.missingTitle(line.required) : undefined}>
                  {compact ? `×${line.missing}` : line.missing}
                </td>
                {!compact && (
                  <td className="num">
                    <PriceInput itemId={line.itemId} toObtain={line.missing} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
