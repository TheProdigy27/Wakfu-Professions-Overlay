// Lignes du chat de Wakfu (wakfu_chat.log) qui annoncent un objet entré dans l'inventaire ou sorti : butin, récolte,
// achat à l'HDV, résultat et ingrédients d'un craft, mise en vente, recyclage ; et les crafts réussis. Textes du jeu
// item.selfLoot, item.selfDrop et craft.knownRecipeExecutionSuccess, quantité au format item.quantity (« [#1]x [#2] »),
// dans le canal chat.pipeName.gameInformation ; format de ligne du log4j du jeu : « %d{HH:mm:ss,SSS} - %m ».
import { LOCALES, type Locale } from '../i18n/locale';

/** Objet ramassé (qty > 0) ou perdu (qty < 0), nommé dans la langue du client de jeu. */
export interface ChatItemChange {
  locale: Locale;
  name: string;
  qty: number;
}

/** Craft réussi : objet fabriqué, avec les lignes du même craft (ingrédients perdus, objet fabriqué ramassé). */
export interface ChatCraft {
  locale: Locale;
  name: string;
  items: ChatItemChange[];
}

/** Ce que le chat annonce, dans l'ordre où il l'écrit. */
export type ChatEvent = ({ kind: 'item' } & ChatItemChange) | ({ kind: 'craft' } & ChatCraft);

const TEXTS: Readonly<Record<Locale, { channel: string; loot: string; drop: string; craft: string }>> = {
  fr: {
    channel: 'Information (jeu)',
    loot: 'Vous avez ramassé',
    drop: 'Vous avez perdu',
    craft: 'Vous avez réussi votre recette de [#1].',
  },
  en: {
    channel: 'Game Log',
    loot: 'You have picked up',
    drop: 'You have lost',
    craft: 'You have successfully completed the [#1] recipe.',
  },
  es: {
    channel: 'Información (juego)',
    loot: 'Has recogido',
    drop: 'Has perdido',
    craft: 'Has realizado con éxito la receta de [#1].',
  },
  pt: { channel: 'Registro de Jogo', loot: 'Você pegou', drop: 'Você perdeu', craft: 'Você completou a receita [#1] com sucesso.' },
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TIME = '(\\d{2}):(\\d{2}):(\\d{2}),(\\d{3})';

/**
 * Quantité : chiffres et séparateurs de milliers de la langue (espace fine insécable en français). Nom : jusqu'au point
 * final, précédé d'une espace en français ; il peut contenir des points (« J.A.R.N.O »).
 */
const PATTERNS = LOCALES.map((locale) => {
  const t = TEXTS[locale];
  const source = `^${TIME} - \\[${escape(t.channel)}\\] (${escape(t.loot)}|${escape(t.drop)}) (\\d[\\d\\s.,]*)x (.+?)\\s*\\.$`;
  return { locale, loot: t.loot, re: new RegExp(source, 'u') };
});

/** Nom de l'objet fabriqué à la place de [#1], sans les espaces qui l'entourent. */
const CRAFT_PATTERNS = LOCALES.map((locale) => {
  const t = TEXTS[locale];
  const [before, after] = t.craft.split('[#1]') as [string, string];
  const source = `^${TIME} - \\[${escape(t.channel)}\\] ${escape(before.trimEnd())}\\s*(.+?)\\s*${escape(after.trimStart())}$`;
  return { locale, re: new RegExp(source, 'u') };
});

const DAY_MS = 86_400_000;

/** Heure de la ligne en millisecondes depuis minuit. */
function lineTime(match: RegExpExecArray): number {
  const [, h, m, s, ms] = match.map(Number) as [number, number, number, number, number];
  return ((h * 60 + m) * 60 + s) * 1000 + ms;
}

/** Ligne du chat (sans fin de ligne) → objet ramassé ou perdu ; null pour toute autre ligne. */
export function parseChatLine(line: string): ChatItemChange | null {
  return parseItemLine(line)?.change ?? null;
}

function parseItemLine(line: string): { change: ChatItemChange; time: number } | null {
  for (const { locale, loot, re } of PATTERNS) {
    const match = re.exec(line);
    if (!match) continue;
    const digits = match[6]!.replace(/\D/g, '');
    const qty = digits.length <= 9 ? Number(digits) : 0;
    const name = match[7]!.trim();
    if (qty <= 0 || !name) return null;
    return { change: { locale, name, qty: match[5] === loot ? qty : -qty }, time: lineTime(match) };
  }
  return null;
}

/** Ligne du chat → craft réussi : langue du client et nom de l'objet fabriqué ; null pour toute autre ligne. */
export function parseCraftLine(line: string): { locale: Locale; name: string; time: number } | null {
  for (const { locale, re } of CRAFT_PATTERNS) {
    const match = re.exec(line);
    if (match) return { locale, name: match[5]!, time: lineTime(match) };
  }
  return null;
}

/** Écart maximal entre les lignes d'un même craft : le jeu les écrit d'un coup, à quelques millisecondes près. */
export const CRAFT_LINES_MS = 500;

/**
 * Lecture du chat ligne à ligne, dans l'ordre. Le jeu écrit un craft d'un bloc : ingrédients perdus, objet fabriqué
 * ramassé, puis « Vous avez réussi votre recette de … ». Les lignes d'objets de ce bloc sont annoncées une à une, puis
 * jointes au craft, même quand le bloc est lu en deux fois.
 */
export class ChatReader {
  /** Objets ramassés ou perdus depuis le dernier craft, avec leur heure. */
  private recent: { change: ChatItemChange; time: number }[] = [];

  read(line: string): ChatEvent | null {
    const item = parseItemLine(line);
    if (item) {
      this.recent = [...this.recent.filter((r) => within(r.time, item.time)), item];
      return { kind: 'item', ...item.change };
    }
    const craft = parseCraftLine(line);
    if (!craft) return null;
    const items = this.recent.filter((r) => within(r.time, craft.time)).map((r) => r.change);
    this.recent = [];
    return { kind: 'craft', locale: craft.locale, name: craft.name, items };
  }
}

/** Ligne écrite à time, au plus CRAFT_LINES_MS avant now ; l'heure repart de zéro à minuit. */
function within(time: number, now: number): boolean {
  return (now - time + DAY_MS) % DAY_MS <= CRAFT_LINES_MS;
}
