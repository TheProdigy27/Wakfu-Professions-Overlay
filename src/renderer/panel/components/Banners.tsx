// Bandeaux d'état : listes non relues ou non enregistrées, raccourci indisponible, recettes modifiées par une mise à jour du jeu,
// nouvelle version de l'application prête à installer.
import { useState } from 'react';
import { describeChange } from '../../../core/data/diffIndex';
import { acceleratorLabel } from '../../../core/state/hotkey';
import { dismissNotices, openSettings, useMessages, usePanel } from '../store';
import { Glyph } from './Glyph';

export function Banners() {
  const m = useMessages();
  const app = usePanel((s) => s.app);
  const update = usePanel((s) => s.update);
  const notices = usePanel((s) => s.notices);
  const index = usePanel((s) => s.catalog?.index);
  const [storeProblemSeen, setStoreProblemSeen] = useState(false);
  const [updateSeen, setUpdateSeen] = useState<string | null>(null);
  if (!app) return null;
  const t = m.banners;

  return (
    <div className="banners">
      {update?.state === 'ready' && updateSeen !== update.version && (
        <div className="banner info" role="status">
          <span>{t.updateReady(update.version, app.autoUpdate)}</span>
          <button type="button" className="link" onClick={() => window.api.installUpdate()}>
            {m.common.restartNow}
          </button>
          <button type="button" className="close" aria-label={m.common.close} onClick={() => setUpdateSeen(update.version)}>
            <Glyph name="close" />
          </button>
        </div>
      )}
      {app.storeProblem && !storeProblemSeen && (
        <div className="banner warning" role="alert">
          <span>{t.storeProblem[app.storeProblem.kind](app.storeProblem.file)}</span>
          <button type="button" className="close" aria-label={m.common.close} onClick={() => setStoreProblemSeen(true)}>
            <Glyph name="close" />
          </button>
        </div>
      )}
      {app.saveError && (
        <div className="banner error" role="alert">
          <span>{t.saveError(app.saveError)}</span>
          <button type="button" className="link" onClick={() => window.api.openLog()}>
            {t.log}
          </button>
        </div>
      )}
      {!app.hotkey.registered && (
        <div className="banner warning" role="alert">
          <span>{t.hotkeyTaken(acceleratorLabel(app.hotkey.accelerator, m))}</span>
          <button type="button" className="link" onClick={() => openSettings(true)}>
            {t.chooseHotkey}
          </button>
        </div>
      )}
      {notices.length > 0 && index && (
        <div className="banner info" role="status">
          <div>
            <span>{t.recipesChanged(index.version)}</span>
            <ul>
              {notices.map((change) => (
                <li key={`${change.kind}-${change.itemId}`}>{describeChange(change, index, m)}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="close" aria-label={m.common.close} onClick={dismissNotices}>
            <Glyph name="close" />
          </button>
        </div>
      )}
    </div>
  );
}
