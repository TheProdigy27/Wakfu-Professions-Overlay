// État du panneau (Zustand) : données du jeu, liste en cours et historique (enregistrés par main), réglages, fenêtre.
import { useMemo } from 'react';
import { create } from 'zustand';
import type { SnapshotChange } from '../../core/data/diffIndex';
import type { DataStatus } from '../../core/data/dataStatus';
import type { GameIndexFile } from '../../core/data/indexFile';
import { loadIndex, type GameIndex } from '../../core/data/loadIndex';
import { LOCALE_TAGS, matchLocale, messages, type Locale, type Messages } from '../../core/i18n';
import { NameVocabulary } from '../../core/match/vocabulary';
import { createSearchIndex, type SearchIndex } from '../../core/match/searchIndex';
import { computeNeeds, type NeedsResult } from '../../core/needs/computeNeeds';
import { chooseRecipe, needsInput, newList, pushHistory, type CraftList, type RecipePrefs } from '../../core/state/craftList';
import { isObsolete, reconcile, withSnapshot } from '../../core/state/reconcile';
import type { AppState, UpdateStatus, WindowState } from '../../preload/api';

export interface Catalog {
  index: GameIndex;
  vocab: NameVocabulary;
  search: SearchIndex;
}

interface PanelState {
  catalog: Catalog | null;
  status: DataStatus | null;
  window: WindowState;
  app: AppState | null;
  update: UpdateStatus | null;
  list: CraftList | null;
  /** Listes quittées, la plus récente en tête. */
  history: CraftList[];
  /** Variantes mémorisées par itemId : valeur par défaut des nouvelles listes. */
  prefs: RecipePrefs;
  /** Listes relues depuis state.json ; avant, aucune modification n'est renvoyée à l'enregistrement. */
  loaded: boolean;
  /** Bandeau : écarts de recettes après une mise à jour du jeu. */
  notices: SnapshotChange[];
  settingsOpen: boolean;
  /** Accueil : premier lancement, ou « Revoir l'accueil » dans les réglages. */
  onboarding: boolean;
}

export const usePanel = create<PanelState>()(() => ({
  catalog: null,
  status: null,
  window: { compact: false, opacity: 0.95 },
  app: null,
  update: null,
  list: null,
  history: [],
  prefs: {},
  loaded: false,
  notices: [],
  settingsOpen: false,
  onboarding: false,
}));

/** Nouvelle liste : changer d'objet repart de zéro, l'ancienne liste passe dans l'historique. */
export function selectTarget(itemId: number): void {
  const { catalog, prefs, list, history } = usePanel.getState();
  if (!catalog || list?.target.itemId === itemId) return;
  usePanel.setState({
    list: withSnapshot(newList(itemId, catalog.index.version, prefs), catalog.index),
    history: list ? pushHistory(history, list) : history,
    notices: [],
  });
}

/** Reprend une liste de l'historique, rapprochée des données du jeu si elles ont changé depuis. */
export function restoreList(id: string): void {
  const { catalog, list, history } = usePanel.getState();
  const chosen = history.find((l) => l.id === id);
  if (!chosen) return;
  const rest = history.filter((l) => l.id !== id);
  const reconciled = catalog ? reconcile(chosen, catalog.index) : { list: chosen, changes: [] };
  usePanel.setState({ list: reconciled.list, history: list ? pushHistory(rest, list) : rest, notices: reconciled.changes });
}

export function removeFromHistory(id: string): void {
  usePanel.setState((s) => ({ history: s.history.filter((l) => l.id !== id) }));
}

export function updateList(change: (list: CraftList) => CraftList): void {
  const { list } = usePanel.getState();
  if (list) usePanel.setState({ list: change(list) });
}

export function selectRecipe(itemId: number, recipeId: number): void {
  const { list, prefs, catalog } = usePanel.getState();
  if (!list || !catalog) return;
  const chosen = chooseRecipe(list, prefs, itemId, recipeId);
  usePanel.setState({ list: withSnapshot(chosen.list, catalog.index), prefs: chosen.prefs });
}

export function openSettings(open: boolean): void {
  usePanel.setState({ settingsOpen: open });
}

export function showOnboarding(show: boolean): void {
  usePanel.setState({ onboarding: show, settingsOpen: false });
  if (!show) window.api.completeOnboarding();
}

export function dismissNotices(): void {
  usePanel.setState({ notices: [] });
}

/** Avant la réponse de main (premier affichage, erreur d'affichage très tôt) : langue du navigateur. */
const FALLBACK_LOCALE = matchLocale(navigator.languages);

export function currentLocale(): Locale {
  return usePanel.getState().app?.locale ?? FALLBACK_LOCALE;
}

export function useLocale(): Locale {
  return usePanel((s) => s.app?.locale) ?? FALLBACK_LOCALE;
}

/** Textes de l'interface dans la langue choisie. */
export function useMessages(): Messages {
  return messages(useLocale());
}

/** Objet cible absent des données du jeu chargées : la liste est en lecture seule. */
export function useObsolete(): boolean {
  const catalog = usePanel((s) => s.catalog);
  const list = usePanel((s) => s.list);
  return !!catalog && !!list && isObsolete(list, catalog.index);
}

/** Calcul des besoins, refait seulement quand les données ou les entrées du calcul changent. */
export function useNeeds(): { catalog: Catalog; list: CraftList; result: NeedsResult } | null {
  const catalog = usePanel((s) => s.catalog);
  const list = usePanel((s) => s.list);
  const result = useMemo(
    () => (catalog && list ? computeNeeds(catalog.index, needsInput(list)) : null),
    // Seules ces parties de la liste changent le calcul (pas la vue affichée ni les nœuds repliés).
    [catalog, list?.target, list?.owned, list?.mode, list?.recipeChoice],
  );
  return catalog && list && result ? { catalog, list, result } : null;
}

/** Index compact courant : chaque langue en tire son catalogue. */
let indexFile: GameIndexFile | null = null;

/** Noms du jeu dans la langue de l'interface, et recherche sur ces noms. */
function buildCatalog(file: GameIndexFile, locale: Locale): Catalog {
  const index = loadIndex(file, locale);
  const vocab = new NameVocabulary(index);
  return { index, vocab, search: createSearchIndex(index, vocab) };
}

/** Nouvel index (démarrage, nouvelle version du jeu) : la liste en cours est rapprochée des nouvelles données. */
async function refreshCatalog(): Promise<void> {
  const file = await window.api.getIndex();
  if (!file) return;
  indexFile = file;
  const catalog = buildCatalog(file, currentLocale());
  const { list, notices } = usePanel.getState();
  const reconciled = list ? reconcile(list, catalog.index) : null;
  usePanel.setState({
    catalog,
    list: reconciled?.list ?? list,
    notices: reconciled?.changes.length ? reconciled.changes : notices,
  });
}

/** Langue changée : mêmes données, noms et recherche dans la nouvelle langue. */
function applyLocale(locale: Locale): void {
  document.documentElement.lang = LOCALE_TAGS[locale];
  const { catalog } = usePanel.getState();
  if (indexFile && catalog && catalog.index.locale !== locale) usePanel.setState({ catalog: buildCatalog(indexFile, locale) });
}

/** Chaque modification des listes part vers main, qui écrit state.json au plus 300 ms plus tard. */
function persistChanges(): void {
  const { api } = window;
  usePanel.subscribe((s, prev) => {
    if (!s.loaded || !prev.loaded) return;
    if (s.list !== prev.list) api.saveCurrent(s.list);
    if (s.history !== prev.history) api.saveHistory(s.history);
    if (s.prefs !== prev.prefs) api.saveRecipePrefs(s.prefs);
  });
}

export async function initStore(): Promise<void> {
  const { api } = window;
  api.onIndexChanged(() => void refreshCatalog());
  api.onDataStatus((status) => usePanel.setState({ status }));
  api.onWindowState((state) => usePanel.setState({ window: state }));
  api.onApp((app) => {
    usePanel.setState({ app });
    applyLocale(app.locale);
  });
  api.onUpdate((update) => usePanel.setState({ update }));
  api.onOpenSettings(() => {
    if (usePanel.getState().window.compact) api.setCompact(false);
    usePanel.setState({ settingsOpen: true, onboarding: false });
  });
  const [status, windowState, app, update, saved] = await Promise.all([
    api.getDataStatus(),
    api.getWindowState(),
    api.getApp(),
    api.getUpdate(),
    api.getLists(),
  ]);
  persistChanges();
  usePanel.setState({
    status,
    window: windowState,
    app,
    update,
    onboarding: !app.onboardingDone,
    list: saved.current,
    history: saved.history,
    prefs: saved.recipePrefs,
    loaded: true,
  });
  applyLocale(app.locale);
  await refreshCatalog();
}
