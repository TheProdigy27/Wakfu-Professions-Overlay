// Listes récentes : les 10 dernières listes quittées, à reprendre telles qu'on les a laissées.
import { useEffect, useRef, useState } from 'react';
import { LOCALE_TAGS } from '../../../core/i18n';
import type { CraftList } from '../../../core/state/craftList';
import { removeFromHistory, restoreList, useLocale, useMessages, usePanel } from '../store';
import { ItemIcon, ItemName } from './Item';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };

export function HistoryMenu() {
  const m = useMessages();
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
        title={history.length ? m.history.title : m.history.empty}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
      >
        {m.history.button} ▾
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
  const m = useMessages();
  const item = usePanel((s) => s.catalog?.index.items.get(list.target.itemId));
  const locale = useLocale();
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
            {new Date(list.updatedAt).toLocaleString(LOCALE_TAGS[locale], DATE_OPTIONS)}
            {owned > 0 && ` · ${m.history.owned(owned)}`}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="close"
        title={m.history.remove}
        aria-label={m.history.remove}
        onClick={() => removeFromHistory(list.id)}
      >
        ✕
      </button>
    </li>
  );
}
