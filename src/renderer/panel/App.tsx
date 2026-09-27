import type { DataStatus } from '../../core/data/dataStatus';
import { MAX_QTY, setTargetQty, setView, type ListView } from '../../core/state/craftList';
import { Banners } from './components/Banners';
import { CraftOrder } from './components/CraftOrder';
import { HistoryMenu } from './components/HistoryMenu';
import { ItemIcon, ItemName, itemMeta } from './components/Item';
import { Onboarding } from './components/Onboarding';
import { SearchBar } from './components/SearchBar';
import { SettingsView } from './components/Settings';
import { ShoppingList } from './components/ShoppingList';
import { TreeView } from './components/TreeView';
import { openSettings, updateList, useNeeds, useObsolete, usePanel } from './store';

const VIEWS: [ListView, string][] = [
  ['tree', 'Arbre'],
  ['shopping', 'Courses'],
  ['order', 'Ordre'],
];

export function App() {
  const compact = usePanel((s) => s.window.compact);
  const settingsOpen = usePanel((s) => s.settingsOpen) && !compact;
  const onboarding = usePanel((s) => s.onboarding) && !compact;
  return (
    <div className={compact ? 'app compact' : 'app'}>
      <Header />
      {!compact && !settingsOpen && (
        <div className="search-row">
          <SearchBar />
          <HistoryMenu />
        </div>
      )}
      {!compact && <Banners />}
      <main className="content">{settingsOpen ? <SettingsView /> : <Body />}</main>
      {!compact && <StatusBar />}
      {onboarding && <Onboarding />}
    </div>
  );
}

function Header() {
  const compact = usePanel((s) => s.window.compact);
  const settingsOpen = usePanel((s) => s.settingsOpen);
  const hotkey = usePanel((s) => s.app?.hotkey);
  const needs = useNeeds();
  const target = needs?.catalog.index.items.get(needs.list.target.itemId);
  return (
    <header className="header">
      <span className="title">
        {compact && needs ? (
          <>
            <ItemName item={target} itemId={needs.list.target.itemId} /> ×{needs.list.target.qty}
          </>
        ) : (
          'Wakfu Professions Overlay'
        )}
      </span>
      <div className="header-actions">
        {!compact && (
          <button
            type="button"
            className={settingsOpen ? 'active' : undefined}
            title="Réglages"
            aria-label="Réglages"
            aria-pressed={settingsOpen}
            onClick={() => openSettings(!settingsOpen)}
          >
            ⚙
          </button>
        )}
        <button
          type="button"
          title={compact ? 'Mode normal' : 'Mode compact'}
          aria-label={compact ? 'Mode normal' : 'Mode compact'}
          onClick={() => window.api.setCompact(!compact)}
        >
          {compact ? '▢' : '▭'}
        </button>
        <button
          type="button"
          title={hotkey?.registered ? `Masquer (${hotkey.label})` : 'Masquer'}
          aria-label="Masquer"
          onClick={() => window.api.hidePanel()}
        >
          ✕
        </button>
      </div>
    </header>
  );
}

function Body() {
  const compact = usePanel((s) => s.window.compact);
  const catalog = usePanel((s) => s.catalog);
  const status = usePanel((s) => s.status);
  const obsolete = useObsolete();
  const needs = useNeeds();

  if (!catalog) {
    const busy = status?.busy;
    return (
      <div className="empty">
        <p>{waitingMessage(status)}</p>
        {busy?.step === 'download' && <progress className="download" max={100} value={busy.percent} />}
      </div>
    );
  }
  if (needs && obsolete) {
    return (
      <p className="empty">
        L'objet de cette liste (#{needs.list.target.itemId}) n'existe plus dans les données du jeu {catalog.index.version}.
        {!compact && ' Recherchez un objet de remplacement : cette liste restera dans les listes récentes.'}
      </p>
    );
  }
  if (!needs) {
    return (
      <p className="empty">
        {compact
          ? 'Aucun objet choisi.'
          : 'Recherchez un objet à crafter, par son nom ou son identifiant (#29236).'}
      </p>
    );
  }
  if (compact) return <ShoppingList {...needs} compact />;

  const { list } = needs;
  const target = catalog.index.items.get(list.target.itemId);
  return (
    <>
      <div className="target">
        <ItemIcon item={target} />
        <div className="target-text">
          <ItemName item={target} itemId={list.target.itemId} />
          {target && <span className="meta">{itemMeta(catalog.index, target)}</span>}
        </div>
        <label className="target-qty">
          Quantité
          <input
            type="number"
            min={1}
            max={MAX_QTY}
            value={list.target.qty}
            onChange={(e) => updateList((l) => setTargetQty(l, Number(e.target.value)))}
          />
        </label>
      </div>
      <nav className="tabs" role="tablist">
        {VIEWS.map(([view, label]) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={list.ui.view === view}
            className={list.ui.view === view ? 'active' : undefined}
            onClick={() => updateList((l) => setView(l, view))}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="view">
        {list.ui.view === 'tree' && <TreeView {...needs} />}
        {list.ui.view === 'shopping' && <ShoppingList {...needs} />}
        {list.ui.view === 'order' && <CraftOrder {...needs} />}
      </div>
    </>
  );
}

function waitingMessage(status: DataStatus | null): string {
  if (status?.busy?.step === 'download') {
    return `Téléchargement des données du jeu ${status.busy.version} depuis les serveurs d'Ankama : ${status.busy.percent} %`;
  }
  if (status?.busy?.step === 'build') return `Préparation des données du jeu ${status.busy.version}…`;
  if (status?.error) return status.error.message;
  return 'Chargement des données du jeu…';
}

function StatusBar() {
  const status = usePanel((s) => s.status);
  if (!status) return null;
  return (
    <footer className="status">
      {status.version ? <span>Données {status.version}</span> : <span>Aucune donnée</span>}
      {status.offline && <span className="badge">hors ligne</span>}
      {status.busy && (
        <span className="busy">
          {status.busy.step === 'download' ? `mise à jour : ${status.busy.percent} %` : 'mise à jour…'}
        </span>
      )}
      {status.error && status.version && (
        <span className="error" title={status.error.message}>
          {status.error.code === 'format' ? 'mise à jour des données impossible' : 'téléchargement interrompu'}
        </span>
      )}
      {(status.error || status.offline) && !status.busy && (
        <button type="button" className="link" onClick={() => void window.api.checkData()}>
          Réessayer
        </button>
      )}
    </footer>
  );
}
