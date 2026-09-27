// Réglages : raccourci, opacité, lancement avec Windows, mises à jour, accélération matérielle, aide.
import { useRef, useState, type KeyboardEvent } from 'react';
import { captureHotkey } from '../../../core/state/hotkey';
import type { AppState } from '../../../preload/api';
import { openSettings, showOnboarding, usePanel } from '../store';

export function SettingsView() {
  const app = usePanel((s) => s.app);
  const opacity = usePanel((s) => s.window.opacity);
  const dataVersion = usePanel((s) => s.status?.version);
  if (!app) return null;
  const { api } = window;

  return (
    <div className="settings">
      <div className="settings-head">
        <h2>Réglages</h2>
        <button type="button" onClick={() => openSettings(false)}>
          Fermer
        </button>
      </div>

      <section>
        <h3>Afficher / masquer le panneau</h3>
        <HotkeyField app={app} />
      </section>

      <section>
        <h3>Affichage</h3>
        <label className="field">
          Opacité
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => api.setOpacity(Number(e.target.value))}
          />
          <span className="num">{Math.round(opacity * 100)} %</span>
        </label>
      </section>

      <section>
        <h3>Démarrage et mises à jour</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={app.launchAtLogin}
            disabled={!app.packaged}
            onChange={(e) => api.setOption('launchAtLogin', e.target.checked)}
          />
          Lancer avec Windows (panneau masqué, dans la zone de notification)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={app.autoUpdate}
            disabled={!app.packaged}
            onChange={(e) => api.setOption('autoUpdate', e.target.checked)}
          />
          Installer automatiquement les mises à jour de l'application
        </label>
        {app.packaged ? <UpdateLine /> : <p className="hint">Disponible dans la version installée de l'application.</p>}
      </section>

      <section>
        <h3>Performances</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={app.hardwareAcceleration}
            onChange={(e) => api.setOption('hardwareAcceleration', e.target.checked)}
          />
          Accélération matérielle
        </label>
        {app.hardwareAcceleration !== app.hardwareAccelerationActive && (
          <p className="hint">
            Prise en compte au prochain démarrage.{' '}
            <button type="button" className="link" onClick={() => api.restart()}>
              Redémarrer maintenant
            </button>
          </p>
        )}
      </section>

      <section>
        <h3>Aide</h3>
        <div className="buttons">
          <button type="button" onClick={() => showOnboarding(true)}>
            Revoir l'accueil
          </button>
          <button type="button" onClick={() => api.openLog()}>
            Ouvrir le journal
          </button>
          <button type="button" onClick={() => api.openDataFolder()}>
            Dossier de l'application
          </button>
        </div>
      </section>

      <p className="about">
        Wakfu Professions Overlay {app.version}
        {dataVersion && ` · données du jeu ${dataVersion}`}
        <br />
        Outil non officiel, non affilié à Ankama. Données et icônes © Ankama.
      </p>
    </div>
  );
}

/** État de la mise à jour de l'application, avec recherche manuelle et installation immédiate. */
function UpdateLine() {
  const update = usePanel((s) => s.update);
  const autoUpdate = usePanel((s) => s.app?.autoUpdate);
  const { api } = window;
  if (!update || update.state === 'unavailable') return null;
  const checkButton = (
    <button type="button" className="link" onClick={() => void api.checkUpdate()}>
      Rechercher une mise à jour
    </button>
  );

  switch (update.state) {
    case 'idle':
      return <p className="hint">{checkButton}</p>;
    case 'checking':
      return <p className="hint">Recherche d'une mise à jour…</p>;
    case 'latest':
      return <p className="hint">Vous avez la dernière version. {checkButton}</p>;
    case 'downloading':
      return (
        <p className="hint">
          Téléchargement de la version {update.version} : {update.percent} %
        </p>
      );
    case 'ready':
      return (
        <p className="hint">
          Version {update.version} prête{autoUpdate ? ', installée à la fermeture de l\'application' : ''}.{' '}
          <button type="button" className="link" onClick={() => api.installUpdate()}>
            Installer et redémarrer
          </button>
        </p>
      );
    case 'error':
      return (
        <p className="error">
          {update.message}{' '}
          <button type="button" className="link" onClick={() => void api.checkUpdate()}>
            Réessayer
          </button>
        </p>
      );
  }
}

/** Saisie d'un nouveau raccourci : on appuie sur la combinaison ; main l'enregistre ou explique pourquoi c'est impossible. */
function HotkeyField({ app }: { app: AppState }) {
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const field = useRef<HTMLButtonElement>(null);
  const { api } = window;

  const start = () => {
    setMessage(null);
    setCapturing(true);
    // Lancée par « Modifier » : le cadre doit recevoir les touches (le bouton cliqué, lui, disparaît).
    field.current?.focus();
    // Sinon, appuyer sur le raccourci actuel masquerait le panneau au lieu d'être saisi.
    api.suspendHotkey(true);
  };
  const cancel = () => {
    setCapturing(false);
    api.suspendHotkey(false);
  };
  const apply = async (accelerator: string) => {
    const result = await api.setHotkey(accelerator);
    setMessage(result.ok ? null : result.message);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) return;
    event.preventDefault();
    const bare = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    if (event.key === 'Escape' && bare) return cancel();
    const result = captureHotkey(event);
    if (result.status === 'pending') return;
    if (result.status === 'invalid') return setMessage(result.message);
    setCapturing(false);
    void apply(result.accelerator);
  };

  return (
    <div className="hotkey-field">
      <button
        ref={field}
        type="button"
        className={capturing ? 'hotkey capturing' : 'hotkey'}
        onClick={capturing ? undefined : start}
        onKeyDown={onKeyDown}
        onBlur={() => capturing && cancel()}
      >
        {capturing ? 'Appuyez sur la combinaison… (Échap : annuler)' : app.hotkey.label}
      </button>
      {!capturing && (
        <button type="button" className="link" onClick={start}>
          Modifier
        </button>
      )}
      {!app.hotkey.registered && !capturing && !message && (
        <p className="error">
          {app.hotkey.label} est déjà utilisé par une autre application.{' '}
          <button type="button" className="link" onClick={() => void apply(app.hotkey.accelerator)}>
            Réessayer
          </button>
        </p>
      )}
      {message && <p className="error">{message}</p>}
      <p className="hint">Fonctionne même quand le jeu a le focus ; le jeu ne reçoit pas cette combinaison.</p>
    </div>
  );
}
