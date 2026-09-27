// Listes récentes : les 10 dernières listes quittées, à reprendre telles qu'on les a laissées.
import { useEffect, useRef, useState } from 'react';
import type { CraftList } from '../../../core/state/craftList';
import { removeFromHistory, restoreList, usePanel } from '../store';
import { ItemIcon, ItemName } from './Item';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function HistoryMenu() {
  const history = usePanel((s) => s.history);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="history" ref={ref}>
      <button
        type="button"
        className="history-button"
        disabled={history.length === 0}
        aria-expanded={open}
        title={history.length ? 'Listes récentes' : 'Aucune liste récente'}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
      >
        Récents ▾
      </button>
      {open && history.length > 0 && (
        <ul className="history-menu">
          {history.map((list) => (
            <HistoryEntry key={list.id} list={list} onDone={() => setOpen(false)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryEntry({ list, onDone }: { list: CraftList; onDone: () => void }) {
  const item = usePanel((s) => s.catalog?.index.items.get(list.target.itemId));
  const owned = Object.keys(list.owned).length;
  return (
    <li>
      <button
        type="button"
        className="history-entry"
        onClick={() => {
          restoreList(list.id);
          onDone();
        }}
      >
        <ItemIcon item={item} />
        <span className="history-text">
          <span>
            <ItemName item={item} itemId={list.target.itemId} />
            <span className="qty">×{list.target.qty}</span>
          </span>
          <span className="meta">
            {DATE.format(new Date(list.updatedAt))}
            {owned > 0 && ` · ${owned} objet${owned > 1 ? 's' : ''} en stock`}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="close"
        title="Retirer des listes récentes"
        aria-label="Retirer des listes récentes"
        onClick={() => removeFromHistory(list.id)}
      >
        ✕
      </button>
    </li>
  );
}
