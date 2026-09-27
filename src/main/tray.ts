// Zone de notification : l'application n'a pas de fenêtre dans la barre des tâches.
import { app, dialog, Menu, Tray, type NativeImage } from 'electron';
import type { GamedataService } from './data/gamedataService';
import type { SettingsController } from './settings';
import type { Updater } from './updater';
import type { PanelWindow } from './windows/panel';

export interface TrayOptions {
  icon: NativeImage;
  panel: PanelWindow;
  data: GamedataService;
  settings: SettingsController;
  updater: Updater;
  openSettings: () => void;
  openLog: () => void;
}

/** Aide du menu « Le panneau n'apparaît pas ? » : plein écran exclusif, raccourci pris. */
async function showHelp(panel: PanelWindow, hotkeyLabel: string, registered: boolean): Promise<void> {
  const hotkey = registered
    ? `Le raccourci ${hotkeyLabel} affiche ou masque le panneau.`
    : `Le raccourci ${hotkeyLabel} est déjà utilisé par une autre application : choisissez-en un autre dans les réglages du panneau.`;
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Wakfu Professions Overlay',
    message: 'Le panneau n\'apparaît pas ?',
    detail:
      'En plein écran exclusif, Windows ne peut rien afficher par-dessus le jeu. Dans les options de Wakfu, ' +
      'passez en mode fenêtré (ou fenêtré sans bordure), puis réaffichez le panneau.\n\n' +
      `${hotkey} Un clic sur cette icône, dans la zone de notification, fait de même.`,
    buttons: ['Afficher le panneau', 'Fermer'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response === 0) panel.show();
}

export function createTray({ icon, panel, data, settings, updater, openSettings, openLog }: TrayOptions): Tray {
  const tray = new Tray(icon);
  tray.setToolTip('Wakfu Professions Overlay (outil non officiel, non affilié à Ankama)');
  const buildMenu = () => {
    const { hotkey } = settings.state;
    const update = updater.status;
    return Menu.buildFromTemplate([
      ...(update.state === 'ready'
        ? [
            { label: `Installer la version ${update.version} et redémarrer`, click: () => updater.install() },
            { type: 'separator' as const },
          ]
        : []),
      {
        label: hotkey.registered ? `Afficher / masquer le panneau (${hotkey.label})` : 'Afficher / masquer le panneau',
        click: () => panel.toggle(),
      },
      { label: 'Mode compact', type: 'checkbox', checked: panel.state.compact, click: (item) => panel.setCompact(item.checked) },
      { label: 'Réglages…', click: openSettings },
      { type: 'separator' },
      { label: 'Vérifier les données du jeu', click: () => void data.check() },
      { label: 'Ouvrir le journal', click: openLog },
      { label: 'Le panneau n\'apparaît pas ?', click: () => void showHelp(panel, hotkey.label, hotkey.registered) },
      { type: 'separator' },
      { label: 'Quitter', click: () => app.quit() },
    ]);
  };
  tray.setContextMenu(buildMenu());
  panel.onState(() => tray.setContextMenu(buildMenu()));
  settings.onChange(() => tray.setContextMenu(buildMenu()));
  // Pas à chaque pourcent téléchargé : le menu ne change qu'une fois la mise à jour prête.
  updater.onChange((status) => status.state !== 'downloading' && tray.setContextMenu(buildMenu()));
  tray.on('click', () => panel.toggle());
  return tray;
}
