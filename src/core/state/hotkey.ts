// Raccourci global d'affichage (accélérateur Electron) : saisie au clavier, libellé dans la langue de l'interface
// et garde-fous. Un raccourci global est intercepté par Windows dans toutes les applications :
// on refuse les combinaisons qui gêneraient la saisie ailleurs, jeu compris.
import type { Messages } from '../i18n';

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+W';

export interface Combo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Touche Windows. */
  meta: boolean;
  /** Nom de la touche dans un accélérateur Electron : « W », « 5 », « F8 », « num3 », « PageUp »… */
  key: string;
}

/** Touche pressée, telle que la donne un KeyboardEvent (keyCode = code de touche virtuelle Windows). */
export interface KeyInput {
  keyCode: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const NAMED_KEYS: Readonly<Record<number, string>> = {
  32: 'Space',
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'Left',
  38: 'Up',
  39: 'Right',
  40: 'Down',
  45: 'Insert',
  46: 'Delete',
  106: 'nummult',
  107: 'numadd',
  109: 'numsub',
  110: 'numdec',
  111: 'numdiv',
};
const NAMED_KEY_SET = new Set(Object.values(NAMED_KEYS));
/** Maj, Ctrl, Alt, Windows gauche et droite. */
const MODIFIER_CODES = new Set([16, 17, 18, 91, 92]);

/** Touches du pavé numérique autres que les chiffres. */
const NUMPAD_SYMBOLS: Readonly<Record<string, string>> = { nummult: '*', numadd: '+', numsub: '-', numdec: '.', numdiv: '/' };

/**
 * keyCode (touche virtuelle) plutôt que key ou code : c'est ce qu'enregistre Windows, et une lettre y garde
 * le nom qu'elle a sur un clavier AZERTY (la touche W produit « W »).
 */
function keyName(keyCode: number): string | null {
  if ((keyCode >= 65 && keyCode <= 90) || (keyCode >= 48 && keyCode <= 57)) return String.fromCharCode(keyCode);
  if (keyCode >= 112 && keyCode <= 135) return `F${keyCode - 111}`;
  if (keyCode >= 96 && keyCode <= 105) return `num${keyCode - 96}`;
  return NAMED_KEYS[keyCode] ?? null;
}

function isKnownKey(key: string): boolean {
  return /^([A-Z0-9]|F([1-9]|1\d|2[0-4])|num\d)$/.test(key) || NAMED_KEY_SET.has(key);
}

const isCharacterKey = (key: string) => /^[A-Z0-9]$/.test(key);
const isFunctionKey = (key: string) => /^F\d+$/.test(key);

/**
 * Raison de refuser une touche ou une combinaison (texte dans Messages.hotkey.problems) :
 * - unsupported-key : ni lettre, ni chiffre, ni F1 à F24, ni pavé numérique, ni touche de navigation ;
 * - no-modifier : sans Ctrl ni Alt, la touche serait bloquée dans toutes les applications, jeu compris ;
 * - altgr : Ctrl+Alt équivaut à AltGr, et empêcherait de taper @, € ou # ;
 * - single-modifier : une seule touche de modification avec une lettre ou un chiffre est déjà prise par la plupart des applications.
 */
export type HotkeyProblem = 'unsupported-key' | 'no-modifier' | 'altgr' | 'single-modifier';

export type CaptureResult =
  | { status: 'pending' }
  | { status: 'invalid'; problem: HotkeyProblem }
  | { status: 'ok'; combo: Combo; accelerator: string };

/** Touche pressée pendant la saisie d'un raccourci : en attente (modificateur seul), refusée ou acceptée. */
export function captureHotkey(input: KeyInput): CaptureResult {
  if (MODIFIER_CODES.has(input.keyCode)) return { status: 'pending' };
  const key = keyName(input.keyCode);
  if (!key) return { status: 'invalid', problem: 'unsupported-key' };
  const combo: Combo = { ctrl: input.ctrlKey, alt: input.altKey, shift: input.shiftKey, meta: input.metaKey, key };
  const problem = comboProblem(combo);
  if (problem) return { status: 'invalid', problem };
  return { status: 'ok', combo, accelerator: toAccelerator(combo) };
}

/** Raison de refuser une combinaison, ou null si elle convient. */
export function comboProblem(combo: Combo): HotkeyProblem | null {
  const { ctrl, alt, shift, meta, key } = combo;
  if (isFunctionKey(key)) return null;
  if (!ctrl && !alt && !meta) return 'no-modifier';
  if (isCharacterKey(key)) {
    if (ctrl && alt && !shift && !meta) return 'altgr';
    if (!meta && [ctrl, alt, shift].filter(Boolean).length < 2) return 'single-modifier';
  }
  return null;
}

export function toAccelerator(combo: Combo): string {
  return [
    combo.ctrl && 'CommandOrControl',
    combo.alt && 'Alt',
    combo.shift && 'Shift',
    combo.meta && 'Super',
    combo.key,
  ]
    .filter(Boolean)
    .join('+');
}

const MODIFIERS: Readonly<Record<string, 'ctrl' | 'alt' | 'shift' | 'meta'>> = {
  commandorcontrol: 'ctrl',
  cmdorctrl: 'ctrl',
  control: 'ctrl',
  ctrl: 'ctrl',
  alt: 'alt',
  shift: 'shift',
  super: 'meta',
  meta: 'meta',
};

/** Accélérateur Electron → combinaison ; null s'il n'est pas de la forme produite par toAccelerator (ou équivalente). */
export function parseAccelerator(accelerator: string): Combo | null {
  const parts = accelerator.split('+');
  const key = parts.pop();
  if (!key || !isKnownKey(key)) return null;
  const combo: Combo = { ctrl: false, alt: false, shift: false, meta: false, key };
  for (const part of parts) {
    const flag = MODIFIERS[part.toLowerCase()];
    if (!flag || combo[flag]) return null;
    combo[flag] = true;
  }
  return combo;
}

/** Libellé avec les noms de touches d'un clavier dans cette langue : « Ctrl+Maj+W » en français. */
export function hotkeyLabel(combo: Combo, m: Messages): string {
  const { modifiers, keys, numpad } = m.hotkey;
  const numKey = /^num(\d)$/.exec(combo.key)?.[1] ?? NUMPAD_SYMBOLS[combo.key];
  const key = numKey ? numpad(numKey) : ((keys as Readonly<Record<string, string>>)[combo.key] ?? combo.key);
  return [combo.ctrl && modifiers.ctrl, combo.alt && modifiers.alt, combo.shift && modifiers.shift, combo.meta && modifiers.meta, key]
    .filter(Boolean)
    .join('+');
}

/** Libellé d'un accélérateur enregistré ; l'accélérateur tel quel s'il n'est pas reconnu. */
export function acceleratorLabel(accelerator: string, m: Messages): string {
  const combo = parseAccelerator(accelerator);
  return combo ? hotkeyLabel(combo, m) : accelerator;
}
