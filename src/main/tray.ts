// Zone de notification : l'application n'a pas de fenêtre dans la barre des tâches.
import { app, dialog, Menu, Tray } from 'electron';
import type { GamedataService } from './data/gamedataService';
import type { SettingsController } from './settings';
import type { Updater } from './updater';
import type { PanelWindow } from './windows/panel';

export interface TrayOptions {
  /** Chemin de l'icône (.ico : Windows y choisit la taille adaptée à l'échelle d'affichage). */
  icon: string;
  panel: PanelWindow;
  data: GamedataService;
  settings: SettingsController;
  updater: Updater;
  openSettings: () => void;
  openLog: () => void;
}

/** Aide du menu « Le panneau n'apparaît pas ? » : plein écran exclusif, raccourci pris. */
async function showHelp(panel: PanelWindow, settings: SettingsController): Promise<void> {
  const t = settings.messages.help;
  const label = settings.hotkeyLabel;
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Wakfu Professions Overlay',
    message: t.message,
    detail: t.detail(settings.state.hotkey.registered ? t.hotkeyOk(label) : t.hotkeyTaken(label)),
    buttons: [t.show, t.close],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response === 0) panel.show();
}

export function createTray({ icon, panel, data, settings, updater, openSettings, openLog }: TrayOptions): Tray {
  const tray = new Tray(icon);
  const buildMenu = () => {
    const t = settings.messages.tray;
    const update = updater.status;
    return Menu.buildFromTemplate([
      ...(update.state === 'ready'
        ? [{ label: t.installUpdate(update.version), click: () => updater.install() }, { type: 'separator' as const }]
        : []),
      {
        label: settings.state.hotkey.registered ? t.toggleWithHotkey(settings.hotkeyLabel) : t.toggle,
        click: () => panel.toggle(),
      },
      { label: t.compactMode, type: 'checkbox', checked: panel.state.compact, click: (item) => panel.setCompact(item.checked) },
      { label: t.settings, click: openSettings },
      { type: 'separator' },
      { label: t.checkData, click: () => void data.check() },
      { label: t.openLog, click: openLog },
      { label: t.help, click: () => void showHelp(panel, settings) },
      { type: 'separator' },
      { label: t.quit, click: () => app.quit() },
    ]);
  };
  const refresh = () => {
    tray.setToolTip(settings.messages.tray.tooltip);
    tray.setContextMenu(buildMenu());
  };
  refresh();
  panel.onState(refresh);
  // Raccourci ou langue changés.
  settings.onChange(refresh);
  // Pas à chaque pourcent téléchargé : le menu ne change qu'une fois la mise à jour prête.
  updater.onChange((status) => status.state !== 'downloading' && refresh());
  tray.on('click', () => panel.toggle());
  return tray;
}
