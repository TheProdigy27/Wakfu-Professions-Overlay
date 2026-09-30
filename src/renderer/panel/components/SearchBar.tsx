// Recherche d'un objet par son nom, même approximatif : une ligne par rareté.
import { useMemo, useState, type KeyboardEvent } from 'react';
import { rarityColor } from '../../../core/data/rarity';
import { selectTarget, useMessages, usePanel } from '../store';
import { ItemIcon, itemMeta } from './Item';

export function SearchBar() {
  const m = useMessages();
  const catalog = usePanel((s) => s.catalog);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => (catalog && query.trim() ? catalog.search.search(query) : []), [catalog, query]);

  const choose = (index: number) => {
    const item = results[index];
    if (!item) return;
    selectTarget(item.id);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (results.length ? (a + step + results.length) % results.length : 0));
    } else if (event.key === 'Enter') {
      choose(active);
    } else if (event.key === 'Escape') {
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div className="search">
      <input
        type="search"
        placeholder={catalog ? m.search.placeholder : m.search.loading}
        disabled={!catalog}
        value={query}
        spellCheck={false}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && query.trim() && catalog && (
        <ul className="search-results" role="listbox">
          {results.length === 0 && <li className="search-empty">{m.search.none}</li>}
          {results.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              // mousedown plutôt que click : le champ perdrait le focus et fermerait la liste avant le clic.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(i);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <ItemIcon item={item} />
              <div className="search-text">
                <span className="item-name" style={{ color: rarityColor(item.rarity) }}>
                  {item.name}
                </span>
                <span className="meta">{itemMeta(catalog.index, item, m)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
