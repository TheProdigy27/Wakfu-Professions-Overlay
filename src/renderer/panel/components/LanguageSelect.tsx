// Choix de la langue de l'interface et des noms du jeu, dans les réglages et dès l'accueil.
import { LOCALE_NAMES, LOCALES, isLocale } from '../../../core/i18n';
import { useLocale, useMessages } from '../store';

export function LanguageSelect() {
  const m = useMessages();
  const locale = useLocale();
  return (
    <label className="field">
      {m.settings.language}
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) window.api.setLanguage(event.target.value);
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
