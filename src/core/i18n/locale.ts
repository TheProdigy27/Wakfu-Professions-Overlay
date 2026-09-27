// Langues de l'interface : celles des noms du jeu (titres fr, en, es et pt des données Ankama).

/** Dans l'ordre des noms de l'index (indexFile.ts). */
export const LOCALES = ['fr', 'en', 'es', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

/** Nom de chaque langue dans cette langue, pour la choisir. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

/** Balise des dates et de l'attribut lang. Le portugais des données du jeu est celui du Brésil. */
export const LOCALE_TAGS: Readonly<Record<Locale, string>> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', pt: 'pt-BR' };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Langues préférées de Windows (« fr-FR », « pt-BR »…) → la première traduite ; l'anglais sinon. */
export function matchLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const lang = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(lang)) return lang;
  }
  return 'en';
}
