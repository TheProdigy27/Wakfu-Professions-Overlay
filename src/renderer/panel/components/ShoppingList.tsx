// Liste de courses : ressources et intermédiaires achetés, avec requis, possédé et reste.
import { useEffect, useState } from 'react';
import { rarityName } from '../../../core/data/rarity';
import type { NeedsResult } from '../../../core/needs/computeNeeds';
import { shoppingList, shoppingText, type ShoppingLine } from '../../../core/needs/shopping';
import { hasAll, needsInput, setMissingOnly, setOwned, toggleHave, type CraftList } from '../../../core/state/craftList';
import { updateList, type Catalog } from '../store';
import { ItemIcon, ItemName } from './Item';

interface ShoppingProps {
  catalog: Catalog;
  list: CraftList;
  result: NeedsResult;
  /** Mode compact : seulement ce qui manque, avec la case et le reste, sans filtre ni en-têtes. */
  compact?: boolean;
}

export function ShoppingList({ catalog, list, result, compact = false }: ShoppingProps) {
  const missingOnly = compact || list.ui.missingOnly;
  const { resources, bought } = shoppingList(catalog.index, result, needsInput(list), { missingOnly });
  const empty = resources.length === 0 && bought.length === 0;

  return (
    <div className="shopping">
      {!compact && (
        <div className="shopping-tools">
          <label className="filter">
            <input type="checkbox" checked={list.ui.missingOnly} onChange={(e) => updateList((l) => setMissingOnly(l, e.target.checked))} />
            Seulement ce qui manque
          </label>
          <CopyButton catalog={catalog} list={list} result={result} />
        </div>
      )}
      {empty && <p className="empty">{missingOnly ? 'Rien ne manque : vous avez tout.' : 'Aucune ressource à obtenir.'}</p>}
      {resources.length > 0 && <Section title="Ressources" lines={resources} catalog={catalog} list={list} compact={compact} />}
      {bought.length > 0 && <Section title="Intermédiaires achetés" lines={bought} catalog={catalog} list={list} compact={compact} />}
    </div>
  );
}

/** Copie ce qui reste à obtenir, en texte, dans le presse-papiers (pour une note, un message…). */
function CopyButton({ catalog, list, result }: { catalog: Catalog; list: CraftList; result: NeedsResult }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    const target = catalog.index.items.get(list.target.itemId);
    const name = target ? `${target.name} (${rarityName(target.rarity)})` : `Objet inconnu #${list.target.itemId}`;
    const lines = shoppingList(catalog.index, result, needsInput(list), { missingOnly: true });
    window.api.copyText(shoppingText(catalog.index, `${name} ×${list.target.qty}`, lines));
    setCopied(true);
  };

  return (
    <button type="button" className="copy" title="Copier ce qui reste à obtenir dans le presse-papiers" onClick={copy}>
      {copied ? 'Copié ✓' : 'Copier'}
    </button>
  );
}

function Section(props: { title: string; lines: ShoppingLine[]; catalog: Catalog; list: CraftList; compact: boolean }) {
  const { title, lines, catalog, list, compact } = props;
  return (
    <section>
      {!compact && <h3>{title}</h3>}
      <table className="shop-table">
        {!compact && (
          <thead>
            <tr>
              <th />
              <th className="name-col">Objet</th>
              <th>Requis</th>
              <th>Possédé</th>
              <th>Reste</th>
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
                    title={`Je l'ai (${line.required})`}
                    onChange={() => updateList((l) => toggleHave(l, line.itemId, line.required))}
                  />
                </td>
                <td className="name-col">
                  <ItemIcon item={item} />
                  <ItemName item={item} itemId={line.itemId} />
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
                      aria-label="Quantité possédée"
                      onChange={(e) => updateList((l) => setOwned(l, line.itemId, Number(e.target.value)))}
                    />
                  </td>
                )}
                <td className="num missing" title={compact ? `Reste à obtenir (sur ${line.required})` : undefined}>
                  {compact ? `×${line.missing}` : line.missing}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
