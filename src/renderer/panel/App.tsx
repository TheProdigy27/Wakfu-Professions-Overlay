import { useEffect, useState } from 'react';
import type { DataStatus } from '../../core/data/dataStatus';
import type { Messages } from '../../core/i18n';
import { MAX_QTY, setTargetQty, setView, type ListView } from '../../core/state/craftList';
import { acceleratorLabel } from '../../core/state/hotkey';
import { Banners } from './components/Banners';
import { CraftOrder } from './components/CraftOrder';
import { Glyph } from './components/Glyph';
import { HistoryMenu } from './components/HistoryMenu';
import { ItemIcon, ItemName, itemMeta } from './components/Item';
import { JobsButton, JobsView } from './components/JobsView';
import { Onboarding } from './components/Onboarding';
import { SearchBar } from './components/SearchBar';
import { SettingsView } from './components/Settings';
import { ShoppingList } from './components/ShoppingList';
import { TreeView } from './components/TreeView';
import { goBack, openSettings, updateList, useCanGoBack, useMessages, useNeeds, useObsolete, usePanel } from './store';

const VIEWS: ListView[] = ['tree', 'shopping', 'order'];

export function App() {
  useBackShortcuts();
  const compact = usePanel((s) => s.window.compact);
  const settingsOpen = usePanel((s) => s.settingsOpen) && !compact;
  const jobsOpen = usePanel((s) => s.jobsOpen) && !compact;
  const onboarding = usePanel((s) => s.onboarding) && !compact;
  // Langue connue seulement avec l'état de l'application : rien n'est affiché avant, pour ne pas changer de langue à l'écran.
  const ready = usePanel((s) => s.app !== null);
  if (!ready) return <div className={compact ? 'app compact' : 'app'} />;
  return (
    <div className={compact ? 'app compact' : 'app'}>
      <Header />
      {!compact && !settingsOpen && (
        <div className="search-row">
          <SearchBar />
          <JobsButton />
          <HistoryMenu />
        </div>
      )}
      {!compact && <Banners />}
      <main className="content">{settingsOpen ? <SettingsView /> : jobsOpen ? <JobsView /> : <Body />}</main>
      {!compact && <StatusBar />}
      {onboarding && <Onboarding />}
    </div>
  );
}

/** Alt+← et bouton « précédent » de la souris : comme le bouton Retour. */
function useBackShortcuts(): void {
  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 3) return;
      event.preventDefault();
      goBack();
    };
    // defaultPrevented : touche déjà prise, par exemple par la saisie d'un nouveau raccourci dans les réglages.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !event.altKey || event.key !== 'ArrowLeft') return;
      event.preventDefault();
      goBack();
    };
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

function Header() {
  const m = useMessages();
  const compact = usePanel((s) => s.window.compact);
  const settingsOpen = usePanel((s) => s.settingsOpen);
  const hotkey = usePanel((s) => s.app?.hotkey);
  const canGoBack = useCanGoBack();
  const needs = useNeeds();
  const target = needs?.catalog.index.items.get(needs.list.target.itemId);
  const t = m.header;
  return (
    <header className="header">
      {!compact && (
        <div className="header-actions">
          <button type="button" title={t.backTitle} aria-label={t.back} disabled={!canGoBack} onClick={goBack}>
            <Glyph name="back" />
          </button>
        </div>
      )}
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
            title={t.settings}
            aria-label={t.settings}
            aria-pressed={settingsOpen}
            onClick={() => openSettings(!settingsOpen)}
          >
            <Glyph name="settings" />
          </button>
        )}
        <button
          type="button"
          title={compact ? t.normalMode : t.compactMode}
          aria-label={compact ? t.normalMode : t.compactMode}
          onClick={() => window.api.setCompact(!compact)}
        >
          <Glyph name={compact ? 'normal' : 'compact'} />
        </button>
        <button
          type="button"
          title={hotkey?.registered ? t.hideWithHotkey(acceleratorLabel(hotkey.accelerator, m)) : t.hide}
          aria-label={t.hide}
          onClick={() => window.api.hidePanel()}
        >
          <Glyph name="close" />
        </button>
      </div>
    </header>
  );
}

function Body() {
  const m = useMessages();
  const compact = usePanel((s) => s.window.compact);
  const catalog = usePanel((s) => s.catalog);
  const status = usePanel((s) => s.status);
  const obsolete = useObsolete();
  const needs = useNeeds();

  if (!catalog) {
    const busy = status?.busy;
    return (
      <div className="empty">
        <p>{waitingMessage(status, m)}</p>
        {busy?.step === 'download' && <progress className="download" max={100} value={busy.percent} />}
      </div>
    );
  }
  if (needs && obsolete) {
    return (
      <p className="empty">
        {m.body.obsolete(needs.list.target.itemId, catalog.index.version)}
        {!compact && ` ${m.body.obsoleteHint}`}
      </p>
    );
  }
  if (!needs) return <p className="empty">{compact ? m.body.noTarget : m.body.searchHint}</p>;
  if (compact) return <ShoppingList {...needs} compact />;

  const { list } = needs;
  const target = catalog.index.items.get(list.target.itemId);
  return (
    <>
      <div className="target">
        <ItemIcon item={target} />
        <div className="target-text">
          <ItemName item={target} itemId={list.target.itemId} />
          {target && <span className="meta">{itemMeta(catalog.index, target, m)}</span>}
        </div>
        <label className="target-qty">
          {m.body.quantity}
          <TargetQty qty={list.target.qty} />
        </label>
      </div>
      <nav className="tabs" role="tablist">
        {VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={list.ui.view === view}
            className={list.ui.view === view ? 'active' : undefined}
            onClick={() => updateList((l) => setView(l, view))}
          >
            {m.views[view]}
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

/** Quantité visée : le champ peut rester vide le temps de taper un autre nombre, la quantité revient à la sortie du champ. */
function TargetQty({ qty }: { qty: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      min={1}
      max={MAX_QTY}
      value={draft ?? qty}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value !== '') updateList((l) => setTargetQty(l, e.target.valueAsNumber));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** Erreur de données du jeu, suivie des données qui restent utilisées s'il y en a. */
function dataErrorText(error: NonNullable<DataStatus['error']>, m: Messages): string {
  const text = m.data.errors[error.code](error.version);
  return error.kept ? `${text} ${m.data.kept(error.kept)}` : text;
}

function waitingMessage(status: DataStatus | null, m: Messages): string {
  if (status?.busy?.step === 'download') return m.data.downloading(status.busy.version, status.busy.percent);
  if (status?.busy?.step === 'build') return m.data.building(status.busy.version);
  if (status?.error) return dataErrorText(status.error, m);
  return m.data.loading;
}

function StatusBar() {
  const m = useMessages();
  const status = usePanel((s) => s.status);
  if (!status) return null;
  const t = m.data.footer;
  return (
    <footer className="status">
      {status.version ? <span>{t.version(status.version)}</span> : <span>{t.none}</span>}
      {status.offline && <span className="badge">{t.offline}</span>}
      {status.busy && (
        <span className="busy">{status.busy.step === 'download' ? t.updatingPercent(status.busy.percent) : t.updating}</span>
      )}
      {status.error && status.version && (
        <span className="error" title={dataErrorText(status.error, m)}>
          {status.error.code === 'format' ? t.formatFailed : t.networkFailed}
        </span>
      )}
      {(status.error || status.offline) && !status.busy && (
        <button type="button" className="link" onClick={() => void window.api.checkData()}>
          {m.common.retry}
        </button>
      )}
    </footer>
  );
}
