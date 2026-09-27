// Bandeaux d'état : listes non relues ou non enregistrées, raccourci indisponible, recettes modifiées par une mise à jour du jeu,
// nouvelle version de l'application prête à installer.
import { useState } from 'react';
import { dismissNotices, openSettings, usePanel } from '../store';

export function Banners() {
  const app = usePanel((s) => s.app);
  const update = usePanel((s) => s.update);
  const notices = usePanel((s) => s.notices);
  const version = usePanel((s) => s.catalog?.index.version);
  const [storeProblemSeen, setStoreProblemSeen] = useState(false);
  const [updateSeen, setUpdateSeen] = useState<string | null>(null);
  if (!app) return null;

  return (
    <div className="banners">
      {update?.state === 'ready' && updateSeen !== update.version && (
        <div className="banner info" role="status">
          <span>
            La version {update.version} de l'application est prête
            {app.autoUpdate ? ' : elle sera installée à la fermeture.' : '.'}
          </span>
          <button type="button" className="link" onClick={() => window.api.installUpdate()}>
            Redémarrer maintenant
          </button>
          <button type="button" className="close" aria-label="Fermer" onClick={() => setUpdateSeen(update.version)}>
            ✕
          </button>
        </div>
      )}
      {app.storeProblem && !storeProblemSeen && (
        <div className="banner warning" role="alert">
          <span>{app.storeProblem}</span>
          <button type="button" className="close" aria-label="Fermer" onClick={() => setStoreProblemSeen(true)}>
            ✕
          </button>
        </div>
      )}
      {app.saveError && (
        <div className="banner error" role="alert">
          <span>{app.saveError}</span>
          <button type="button" className="link" onClick={() => window.api.openLog()}>
            Journal
          </button>
        </div>
      )}
      {!app.hotkey.registered && (
        <div className="banner warning" role="alert">
          <span>{app.hotkey.label} est déjà utilisé par une autre application : le panneau ne s'affiche plus au clavier.</span>
          <button type="button" className="link" onClick={() => openSettings(true)}>
            Choisir un autre raccourci
          </button>
        </div>
      )}
      {notices.length > 0 && (
        <div className="banner info" role="status">
          <div>
            <span>Recettes modifiées par la mise à jour du jeu{version ? ` (${version})` : ''} :</span>
            <ul>
              {notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="close" aria-label="Fermer" onClick={dismissNotices}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
