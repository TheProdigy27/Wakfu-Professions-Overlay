// Lignes du chat de Wakfu (wakfu_chat.log) qui annoncent un objet entré dans l'inventaire ou sorti : butin, récolte,
// achat à l'HDV, résultat et ingrédients d'un craft, mise en vente, recyclage. Textes du jeu item.selfLoot et
// item.selfDrop, quantité au format item.quantity (« [#1]x [#2] »), dans le canal chat.pipeName.gameInformation ;
// format de ligne du log4j du jeu : « %d{HH:mm:ss,SSS} - %m ».
import { LOCALES, type Locale } from '../i18n/locale';

/** Objet ramassé (qty > 0) ou perdu (qty < 0), nommé dans la langue du client de jeu. */
export interface ChatItemChange {
  locale: Locale;
  name: string;
  qty: number;
}

const TEXTS: Readonly<Record<Locale, { channel: string; loot: string; drop: string }>> = {
  fr: { channel: 'Information (jeu)', loot: 'Vous avez ramassé', drop: 'Vous avez perdu' },
  en: { channel: 'Game Log', loot: 'You have picked up', drop: 'You have lost' },
  es: { channel: 'Información (juego)', loot: 'Has recogido', drop: 'Has perdido' },
  pt: { channel: 'Registro de Jogo', loot: 'Você pegou', drop: 'Você perdeu' },
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Quantité : chiffres et séparateurs de milliers de la langue (espace fine insécable en français). Nom : jusqu'au point
 * final, précédé d'une espace en français ; il peut contenir des points (« J.A.R.N.O »).
 */
const PATTERNS = LOCALES.map((locale) => {
  const t = TEXTS[locale];
  const source = `^\\d{2}:\\d{2}:\\d{2},\\d{3} - \\[${escape(t.channel)}\\] (${escape(t.loot)}|${escape(t.drop)}) (\\d[\\d\\s.,]*)x (.+?)\\s*\\.$`;
  return { locale, loot: t.loot, re: new RegExp(source, 'u') };
});

/** Ligne du chat (sans fin de ligne) → objet ramassé ou perdu ; null pour toute autre ligne. */
export function parseChatLine(line: string): ChatItemChange | null {
  for (const { locale, loot, re } of PATTERNS) {
    const match = re.exec(line);
    if (!match) continue;
    const digits = match[2]!.replace(/\D/g, '');
    const qty = digits.length <= 9 ? Number(digits) : 0;
    const name = match[3]!.trim();
    if (qty <= 0 || !name) return null;
    return { locale, name, qty: match[1] === loot ? qty : -qty };
  }
  return null;
}
