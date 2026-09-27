// Textes de l'interface dans chaque langue.
import { en } from './en';
import { es } from './es';
import { fr, type Messages } from './fr';
import type { Locale } from './locale';
import { pt } from './pt';

export type { Messages };
export * from './locale';

const MESSAGES: Readonly<Record<Locale, Messages>> = { fr, en, es, pt };

export function messages(locale: Locale): Messages {
  return MESSAGES[locale];
}
