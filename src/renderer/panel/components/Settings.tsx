// Réglages : langue, raccourci, opacité, lancement avec Windows, affichage avec Wakfu, mises à jour, accélération matérielle,
// aide.
import { useRef, useState, type KeyboardEvent } from 'react';
import type { Messages } from '../../../core/i18n';
import { acceleratorLabel, captureHotkey } from '../../../core/state/hotkey';
import type { AppState, HotkeyChange } from '../../../preload/api';
import { openSettings, showOnboarding, useMessages, usePanel } from '../store';
import { LanguageSelect } from './LanguageSelect';

export function SettingsView() {
  const m = useMessages();
  const app = usePanel((s) => s.app);
  const opacity = usePanel((s) => s.window.opacity);
  const dataVersion = usePanel((s) => s.status?.version);
  if (!app) return null;
  const { api } = window;
  const t = m.settings;

  return (
    <div className="settings">
      <div className="settings-head">
        <h2>{t.title}</h2>
        <button type="button" onClick={() => openSettings(false)}>
          {m.common.close}
        </button>
      </div>

      <section>
        <LanguageSelect />
      </section>

      <section>
        <h3>{t.hotkey}</h3>
        <HotkeyField app={app} />
      </section>

      <section>
        <h3>{t.display}</h3>
        <label className="field">
          {t.opacity}
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => api.setOpacity(Number(e.target.value))}
          />
          <span className="num">{m.common.percent(Math.round(opacity * 100))}</span>
        </label>
      </section>

      <section>
        <h3>{t.startup}</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={app.launchAtLogin}
            disabled={!app.packaged}
            onChange={(e) => api.setOption('launchAtLogin', e.target.checked)}
          />
          {t.launchAtLogin}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={app.showWithWakfu}
            onChange={(e) => api.setOption('showWithWakfu', e.target.checked)}
          />
          {t.showWithWakfu}
        </label>
        {app.showWithWakfu && app.packaged && !app.launchAtLogin && <p className="hint">{t.showWithWakfuHint}</p>}
        <label className="check">
          <input
            type="checkbox"
            checked={app.autoUpdate}
            disabled={!app.packaged}
            onChange={(e) => api.setOption('autoUpdate', e.target.checked)}
          />
          {t.autoUpdate}
        </label>
        {app.packaged ? <UpdateLine /> : <p className="hint">{t.packagedOnly}</p>}
      </section>

      <section>
        <h3>{t.performance}</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={app.hardwareAcceleration}
            onChange={(e) => api.setOption('hardwareAcceleration', e.target.checked)}
          />
          {t.hardwareAcceleration}
        </label>
        {app.hardwareAcceleration !== app.hardwareAccelerationActive && (
          <p className="hint">
            {t.nextStart}{' '}
            <button type="button" className="link" onClick={() => api.restart()}>
              {m.common.restartNow}
            </button>
          </p>
        )}
      </section>

      <section>
        <h3>{t.help}</h3>
        <div className="buttons">
          <button type="button" onClick={() => showOnboarding(true)}>
            {t.showOnboarding}
          </button>
          <button type="button" onClick={() => api.openLog()}>
            {m.common.openLog}
          </button>
          <button type="button" onClick={() => api.openDataFolder()}>
            {t.appFolder}
          </button>
        </div>
      </section>

      <p className="about">
        Wakfu Professions Overlay {app.version}
        {dataVersion && ` · ${t.dataVersion(dataVersion)}`}
        <br />
        {m.common.disclaimer}
      </p>
    </div>
  );
}

/** État de la mise à jour de l'application, avec recherche manuelle et installation immédiate. */
function UpdateLine() {
  const m = useMessages();
  const update = usePanel((s) => s.update);
  const autoUpdate = usePanel((s) => s.app?.autoUpdate) ?? false;
  const { api } = window;
  if (!update || update.state === 'unavailable') return null;
  const t = m.update;
  const checkButton = (
    <button type="button" className="link" onClick={() => void api.checkUpdate()}>
      {t.check}
    </button>
  );

  switch (update.state) {
    case 'idle':
      return <p className="hint">{checkButton}</p>;
    case 'checking':
      return <p className="hint">{t.checking}</p>;
    case 'latest':
      return (
        <p className="hint">
          {t.latest} {checkButton}
        </p>
      );
    case 'downloading':
      return <p className="hint">{t.downloading(update.version, update.percent)}</p>;
    case 'ready':
      return (
        <p className="hint">
          {t.ready(update.version, autoUpdate)}{' '}
          <button type="button" className="link" onClick={() => api.installUpdate()}>
            {t.install}
          </button>
        </p>
      );
    case 'error':
      return (
        <p className="error">
          {update.reason === 'download' ? t.downloadFailed(update.version) : t.errors[update.reason]}{' '}
          <button type="button" className="link" onClick={() => void api.checkUpdate()}>
            {m.common.retry}
          </button>
        </p>
      );
  }
}

/** Raison d'un raccourci refusé, dans la langue de l'interface. */
function refusal(change: Extract<HotkeyChange, { ok: false }>, accelerator: string, m: Messages): string {
  const label = acceleratorLabel(accelerator, m);
  switch (change.problem) {
    case 'invalid':
      return m.hotkey.invalid;
    case 'taken':
      return m.hotkey.takenChooseAnother(label);
    case 'not-global':
      return m.hotkey.notGlobal(label);
    default:
      return m.hotkey.problems[change.problem];
  }
}

/** Saisie d'un nouveau raccourci : on appuie sur la combinaison ; main l'enregistre ou explique pourquoi c'est impossible. */
function HotkeyField({ app }: { app: AppState }) {
  const m = useMessages();
  const [capturing, setCapturing] = useState(false);
  // Message gardé sous forme de fonction : il suit un changement de langue.
  const [message, setMessage] = useState<((m: Messages) => string) | null>(null);
  const field = useRef<HTMLButtonElement>(null);
  const { api } = window;
  const label = acceleratorLabel(app.hotkey.accelerator, m);

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
    setMessage(result.ok ? null : () => (msgs: Messages) => refusal(result, accelerator, msgs));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) return;
    event.preventDefault();
    const bare = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    if (event.key === 'Escape' && bare) return cancel();
    const result = captureHotkey(event);
    if (result.status === 'pending') return;
    if (result.status === 'invalid') return setMessage(() => (msgs: Messages) => msgs.hotkey.problems[result.problem]);
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
        {capturing ? m.hotkey.capturing : label}
      </button>
      {!capturing && (
        <button type="button" className="link" onClick={start}>
          {m.hotkey.change}
        </button>
      )}
      {!app.hotkey.registered && !capturing && !message && (
        <p className="error">
          {m.hotkey.taken(label)}{' '}
          <button type="button" className="link" onClick={() => void apply(app.hotkey.accelerator)}>
            {m.common.retry}
          </button>
        </p>
      )}
      {message && <p className="error">{message(m)}</p>}
      <p className="hint">{m.hotkey.hint}</p>
    </div>
  );
}
