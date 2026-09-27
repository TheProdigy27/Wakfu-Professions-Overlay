// Accueil au premier lancement : langue, raccourci, focus, plein écran, listes, données Ankama.
import { acceleratorLabel } from '../../../core/state/hotkey';
import { showOnboarding, useMessages, usePanel } from '../store';
import { LanguageSelect } from './LanguageSelect';

export function Onboarding() {
  const m = useMessages();
  const hotkey = usePanel((s) => s.app?.hotkey);
  const t = m.onboarding;
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <div className="onboarding-head">
          <h2 id="onboarding-title">{t.title}</h2>
          <LanguageSelect />
        </div>
        <ul>
          {t.tips(hotkey && acceleratorLabel(hotkey.accelerator, m)).map(([strong, rest]) => (
            <li key={strong}>
              <strong>{strong}</strong>
              {rest}
            </li>
          ))}
        </ul>
        <p className="about">{m.common.disclaimer}</p>
        <button type="button" className="primary" autoFocus onClick={() => showOnboarding(false)}>
          {t.ok}
        </button>
      </div>
    </div>
  );
}
