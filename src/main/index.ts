// Processus principal : instance unique, état sauvegardé, données du jeu, panneau, zone de notification, raccourci global,
// affichage avec Wakfu, mises à jour de l'application.
import { fileURLToPath } from 'node:url';
import { app, Menu, session, shell, type BrowserWindow } from 'electron';
import iconPath from '../../resources/icon.ico?asset&asarUnpack';
import { IPC } from '../preload/api';
import { GamedataService, type FetchLike } from './data/gamedataService';
import { createIconLoader } from './data/iconCache';
import { handleIconProtocol, registerIconScheme } from './data/iconProtocol';
import { registerIpc } from './ipc';
import { createLogger, logFile } from './log';
import { HIDDEN_ARG, SettingsController } from './settings';
import { ToggleHotkey } from './shortcuts';
import { JsonStore } from './store/jsonStore';
import { createTray } from './tray';
import { Updater } from './updater';
import { WakfuWatcher } from './wakfu';
import { PanelWindow } from './windows/panel';

const dir = app.getPath('userData');
const log = createLogger(dir);

/**
 * Tests de bout en bout (tests/e2e) : aucun accès réseau, ni aux serveurs d'Ankama ni à GitHub. Les données du jeu
 * viennent du cache préparé par le test ; l'application fonctionne comme hors ligne.
 */
const OFFLINE = process.env['WPO_OFFLINE'] === '1';
const noNetwork: FetchLike = () => Promise.reject(new Error('réseau désactivé (WPO_OFFLINE)'));

async function loadPanel(win: BrowserWindow): Promise<void> {
  const devServer = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devServer) await win.loadURL(`${devServer}/panel/index.html`);
  else await win.loadFile(fileURLToPath(new URL('../renderer/panel/index.html', import.meta.url)));
}

async function openPath(target: string): Promise<void> {
  const error = await shell.openPath(target);
  if (error) log(`ouverture de ${target} impossible : ${error}`);
}

async function start(store: JsonStore): Promise<void> {
  await app.whenReady();
  Menu.setApplicationMenu(null);
  // Aucune permission (caméra, notifications…) n'est accordée au contenu.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  const fetch = OFFLINE ? noNetwork : undefined;
  const data = new GamedataService({ dir, log, fetch });
  handleIconProtocol(createIconLoader({ dir, log, fetch }));

  const { settings: saved, window: bounds } = store.get();
  const panel = new PanelWindow({
    preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
    load: loadPanel,
    icon: iconPath,
    log,
    initial: { state: { compact: saved.compact, opacity: saved.opacity }, bounds },
    onSessionEnd: () => store.flush(),
  });
  panel.onState(({ compact, opacity }) => store.update((s) => ({ ...s, settings: { ...s.settings, compact, opacity } })));
  panel.onBounds((next) => store.update((s) => ({ ...s, window: next })));
  const updater = new Updater({ available: app.isPackaged && !OFFLINE, enabled: saved.autoUpdate, log });
  // Données et application revérifiées à l'affichage si la dernière vérification date de plus de 6 h.
  panel.onShow(() => {
    void data.checkIfStale();
    updater.checkIfStale();
  });

  const hotkey = new ToggleHotkey(() => panel.toggle());
  const settings = new SettingsController(store, hotkey, log);
  const wakfu = new WakfuWatcher({
    log,
    onStart: () => {
      log('Wakfu lancé : panneau affiché');
      panel.show();
    },
    onStop: () => {
      log('Wakfu fermé : panneau masqué');
      panel.hide();
    },
  });
  settings.onChange((state) => updater.setEnabled(state.autoUpdate));
  const openLog = () => void openPath(logFile(dir));
  registerIpc({
    data,
    updater,
    panel,
    store,
    settings,
    log,
    openLog,
    openDataFolder: () => void openPath(dir),
    restart: () => {
      app.relaunch();
      app.quit();
    },
  });
  panel.create();

  const registered = settings.start();
  const tray = createTray({
    icon: iconPath,
    panel,
    data,
    settings,
    updater,
    openLog,
    openSettings: () => {
      panel.show();
      panel.send(IPC.openSettings);
    },
  });
  if (!registered) {
    const t = settings.messages.hotkeyBalloon;
    tray.displayBalloon({ iconType: 'warning', title: t.title, content: t.content(settings.hotkeyLabel) });
  }

  app.on('second-instance', () => panel.show());
  app.on('before-quit', () => {
    store.flush();
    panel.prepareQuit();
  });
  app.on('will-quit', () => hotkey.unregisterAll());
  // Le panneau masqué n'est pas fermé ; l'application ne quitte que depuis la zone de notification.
  app.on('window-all-closed', () => {});

  log(`démarrage ${app.getName()} ${app.getVersion()}${OFFLINE ? ' (hors réseau)' : ''}`);
  if (store.loadProblem) log(`state.json mis de côté (${store.loadProblem.file}), état vierge`);
  await data.loadCache();
  // Lancement avec Windows : l'application attend dans la zone de notification.
  if (!process.argv.includes(HIDDEN_ARG)) panel.show();
  // Après le cache : afficher le panneau lance la vérification des données, qui doit connaître la version en cache.
  wakfu.setEnabled(settings.settings.showWithWakfu);
  settings.onChange((state) => wakfu.setEnabled(state.showWithWakfu));
  updater.start();
  await data.check();
}

registerIconScheme();
if (app.requestSingleInstanceLock()) {
  // Lecture synchrone avant app.whenReady() : l'accélération matérielle ne se désactive qu'avant.
  const store = new JsonStore({ dir, log });
  if (!store.get().settings.hardwareAcceleration) app.disableHardwareAcceleration();
  start(store).catch((err: unknown) => {
    log(`démarrage impossible : ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    app.exit(1);
  });
} else {
  app.quit();
}
