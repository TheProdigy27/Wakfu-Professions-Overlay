// Canaux IPC du panneau (liste blanche de preload/api.ts). Seul le panneau peut les appeler ; tout ce qu'il envoie est validé.
import { clipboard, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type { ZodType } from 'zod';
import { CraftListSchema, HistorySchema, RecipePrefsSchema, type PersistedState } from '../core/state/schema';
import { IPC, type SavedLists } from '../preload/api';
import type { GamedataService } from './data/gamedataService';
import type { SettingsController } from './settings';
import type { JsonStore } from './store/jsonStore';
import type { Updater } from './updater';
import type { PanelWindow } from './windows/panel';

export interface IpcContext {
  data: GamedataService;
  updater: Updater;
  panel: PanelWindow;
  store: JsonStore;
  settings: SettingsController;
  log: (message: string) => void;
  openLog: () => void;
  openDataFolder: () => void;
  restart: () => void;
}

const MAX_TEXT = 100_000;

export function registerIpc({ data, updater, panel, store, settings, log, openLog, openDataFolder, restart }: IpcContext): void {
  const fromPanel = (event: IpcMainEvent | IpcMainInvokeEvent) => event.sender === panel.webContents;
  const handle = <T>(channel: string, fn: (value: unknown) => T) =>
    ipcMain.handle(channel, (event, value: unknown) => {
      if (!fromPanel(event)) throw new Error(`${channel} : émetteur non autorisé`);
      return fn(value);
    });
  const on = (channel: string, fn: (...values: unknown[]) => void) =>
    ipcMain.on(channel, (event, ...values: unknown[]) => {
      if (fromPanel(event)) fn(...values);
    });
  /** Listes envoyées par le panneau : validées avant d'aller dans state.json. */
  const save = <K extends keyof PersistedState>(channel: string, key: K, schema: ZodType<PersistedState[K]>) =>
    on(channel, (value) => {
      const parsed = schema.safeParse(value);
      if (parsed.success) store.update((s) => ({ ...s, [key]: parsed.data }));
      else log(`${channel} : données refusées (${parsed.error.issues[0]?.message ?? 'invalides'})`);
    });

  handle(IPC.getIndex, () => data.indexFile);
  handle(IPC.getDataStatus, () => data.status);
  handle(IPC.checkData, () => data.check());
  handle(IPC.getWindowState, () => panel.state);
  on(IPC.setOpacity, (value) => {
    if (typeof value === 'number') panel.setOpacity(value);
  });
  on(IPC.setCompact, (value) => {
    if (typeof value === 'boolean') panel.setCompact(value);
  });
  on(IPC.hidePanel, () => panel.hide());

  handle(IPC.getApp, () => settings.state);
  handle(IPC.getLists, (): SavedLists => {
    const { current, history, recipePrefs } = store.get();
    return { current, history, recipePrefs };
  });
  save(IPC.saveCurrent, 'current', CraftListSchema.nullable());
  save(IPC.saveHistory, 'history', HistorySchema);
  save(IPC.saveRecipePrefs, 'recipePrefs', RecipePrefsSchema);
  handle(IPC.setHotkey, (value) => settings.setHotkey(value));
  on(IPC.suspendHotkey, (value) => settings.suspendHotkey(value === true));
  on(IPC.setOption, (name, value) => settings.setOption(name, value));
  on(IPC.completeOnboarding, () => settings.completeOnboarding());
  on(IPC.restart, restart);
  handle(IPC.getUpdate, () => updater.status);
  handle(IPC.checkUpdate, () => updater.check());
  on(IPC.installUpdate, () => updater.install());
  on(IPC.openLog, openLog);
  on(IPC.openDataFolder, openDataFolder);
  on(IPC.copyText, (value) => {
    if (typeof value === 'string' && value.length <= MAX_TEXT) clipboard.writeText(value);
  });
  on(IPC.log, (value) => {
    if (typeof value === 'string') log(`panneau : ${value.slice(0, 2000)}`);
  });

  data.onStatus((status) => panel.send(IPC.dataStatus, status));
  data.onIndex(() => panel.send(IPC.indexChanged));
  panel.onState((state) => panel.send(IPC.windowState, state));
  settings.onChange((state) => panel.send(IPC.appState, state));
  updater.onChange((status) => panel.send(IPC.updateStatus, status));
}
