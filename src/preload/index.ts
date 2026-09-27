// Preload sandboxé : seule l'API ci-dessous est visible du renderer, sans accès à Node ni à ipcRenderer.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type PanelApi } from './api';

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: PanelApi = {
  getIndex: () => ipcRenderer.invoke(IPC.getIndex),
  onIndexChanged: (listener) => subscribe(IPC.indexChanged, listener),
  getDataStatus: () => ipcRenderer.invoke(IPC.getDataStatus),
  onDataStatus: (listener) => subscribe(IPC.dataStatus, listener),
  checkData: () => ipcRenderer.invoke(IPC.checkData),
  getWindowState: () => ipcRenderer.invoke(IPC.getWindowState),
  onWindowState: (listener) => subscribe(IPC.windowState, listener),
  setOpacity: (opacity) => ipcRenderer.send(IPC.setOpacity, opacity),
  setCompact: (compact) => ipcRenderer.send(IPC.setCompact, compact),
  hidePanel: () => ipcRenderer.send(IPC.hidePanel),

  getApp: () => ipcRenderer.invoke(IPC.getApp),
  onApp: (listener) => subscribe(IPC.appState, listener),
  onOpenSettings: (listener) => subscribe(IPC.openSettings, listener),
  getLists: () => ipcRenderer.invoke(IPC.getLists),
  saveCurrent: (list) => ipcRenderer.send(IPC.saveCurrent, list),
  saveHistory: (history) => ipcRenderer.send(IPC.saveHistory, history),
  saveRecipePrefs: (prefs) => ipcRenderer.send(IPC.saveRecipePrefs, prefs),
  setHotkey: (accelerator) => ipcRenderer.invoke(IPC.setHotkey, accelerator),
  suspendHotkey: (suspended) => ipcRenderer.send(IPC.suspendHotkey, suspended),
  setOption: (name, value) => ipcRenderer.send(IPC.setOption, name, value),
  completeOnboarding: () => ipcRenderer.send(IPC.completeOnboarding),
  restart: () => ipcRenderer.send(IPC.restart),
  getUpdate: () => ipcRenderer.invoke(IPC.getUpdate),
  onUpdate: (listener) => subscribe(IPC.updateStatus, listener),
  checkUpdate: () => ipcRenderer.invoke(IPC.checkUpdate),
  installUpdate: () => ipcRenderer.send(IPC.installUpdate),
  openLog: () => ipcRenderer.send(IPC.openLog),
  openDataFolder: () => ipcRenderer.send(IPC.openDataFolder),
  copyText: (text) => ipcRenderer.send(IPC.copyText, text),
  log: (message) => ipcRenderer.send(IPC.log, message),
};

contextBridge.exposeInMainWorld('api', api);
