import { describe, expect, it } from 'vitest';
import {
  acceleratorLabel,
  captureHotkey,
  comboProblem,
  DEFAULT_HOTKEY,
  hotkeyLabel,
  parseAccelerator,
  toAccelerator,
  type KeyInput,
} from '../../../src/core/state/hotkey';

const key = (keyCode: number, mods: Partial<Omit<KeyInput, 'keyCode'>> = {}): KeyInput => ({
  keyCode,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});
const W = 87;

describe('captureHotkey', () => {
  it('Ctrl+Maj+W donne le raccourci par défaut', () => {
    expect(captureHotkey(key(W, { ctrlKey: true, shiftKey: true }))).toEqual({
      status: 'ok',
      combo: { ctrl: true, alt: false, shift: true, meta: false, key: 'W' },
      accelerator: DEFAULT_HOTKEY,
      label: 'Ctrl+Maj+W',
    });
  });

  it('attend la touche principale tant que seuls des modificateurs sont enfoncés', () => {
    for (const code of [16, 17, 18, 91, 92]) expect(captureHotkey(key(code, { ctrlKey: true }))).toEqual({ status: 'pending' });
  });

  it('nomme les touches comme Electron', () => {
    const accel = (code: number) => {
      const r = captureHotkey(key(code, { ctrlKey: true, altKey: true, shiftKey: true }));
      return r.status === 'ok' ? r.accelerator : r.status;
    };
    expect(accel(65)).toBe('CommandOrControl+Alt+Shift+A');
    expect(accel(53)).toBe('CommandOrControl+Alt+Shift+5');
    expect(accel(119)).toBe('CommandOrControl+Alt+Shift+F8');
    expect(accel(135)).toBe('CommandOrControl+Alt+Shift+F24');
    expect(accel(99)).toBe('CommandOrControl+Alt+Shift+num3');
    expect(accel(107)).toBe('CommandOrControl+Alt+Shift+numadd');
    expect(accel(33)).toBe('CommandOrControl+Alt+Shift+PageUp');
    expect(accel(38)).toBe('CommandOrControl+Alt+Shift+Up');
    expect(accel(32)).toBe('CommandOrControl+Alt+Shift+Space');
    // Touches dont le caractère dépend de la disposition du clavier (ponctuation), Entrée, Tab : refusées.
    for (const code of [186, 188, 222, 13, 9, 27]) expect(accel(code)).toBe('invalid');
  });

  it('refuse les combinaisons qui gêneraient la saisie ailleurs', () => {
    const problem = (code: number, mods: Partial<Omit<KeyInput, 'keyCode'>>) => {
      const r = captureHotkey(key(code, mods));
      return r.status === 'invalid' ? r.message : null;
    };
    expect(problem(W, {})).toMatch(/Ajoutez Ctrl ou Alt/);
    expect(problem(W, { shiftKey: true })).toMatch(/Ajoutez Ctrl ou Alt/);
    expect(problem(38, { shiftKey: true })).toMatch(/Ajoutez Ctrl ou Alt/);
    expect(problem(67, { ctrlKey: true })).toMatch(/ajoutez Maj/);
    expect(problem(W, { altKey: true })).toMatch(/ajoutez Maj/);
    // Ctrl+Alt = AltGr : Ctrl+Alt+0 empêcherait de taper @ sur un clavier français.
    expect(problem(48, { ctrlKey: true, altKey: true })).toMatch(/AltGr/);
    expect(problem(69, { ctrlKey: true, altKey: true })).toMatch(/AltGr/);
    // Acceptées : touche F seule, touche de navigation avec Ctrl, Windows + lettre, Ctrl+Alt+Maj + lettre.
    expect(problem(119, {})).toBeNull();
    expect(problem(38, { ctrlKey: true })).toBeNull();
    expect(problem(W, { metaKey: true })).toBeNull();
    expect(problem(W, { ctrlKey: true, altKey: true, shiftKey: true })).toBeNull();
  });
});

describe('accélérateurs', () => {
  it('lecture et écriture sont réciproques', () => {
    for (const accel of [DEFAULT_HOTKEY, 'Alt+Shift+Super+F12', 'CommandOrControl+num0', 'CommandOrControl+Alt+Shift+Delete']) {
      expect(toAccelerator(parseAccelerator(accel)!)).toBe(accel);
    }
  });

  it('accepte les autres noms de Ctrl, et les modificateurs dans le désordre', () => {
    expect(parseAccelerator('Shift+Ctrl+W')).toEqual(parseAccelerator(DEFAULT_HOTKEY));
    expect(parseAccelerator('Control+shift+W')).toEqual(parseAccelerator(DEFAULT_HOTKEY));
    expect(parseAccelerator('CmdOrCtrl+Shift+W')).toEqual(parseAccelerator(DEFAULT_HOTKEY));
  });

  it('rejette ce qui ne vient pas de la saisie', () => {
    for (const bad of ['', 'Ctrl+', 'Ctrl+Ctrl+W', 'Ctrl+Hyper+W', 'Ctrl+Shift+w', 'Ctrl+Shift+F25', 'Ctrl+Shift+Enter', 'Ctrl+Shift+W+X']) {
      expect(parseAccelerator(bad), bad).toBeNull();
    }
    // « W » seul se lit, mais le processus principal le refuse ensuite.
    expect(comboProblem(parseAccelerator('W')!)).not.toBeNull();
  });

  it('libellés pour un clavier français', () => {
    expect(acceleratorLabel(DEFAULT_HOTKEY)).toBe('Ctrl+Maj+W');
    expect(acceleratorLabel('Alt+Shift+Super+F12')).toBe('Alt+Maj+Win+F12');
    expect(hotkeyLabel(parseAccelerator('CommandOrControl+num7')!)).toBe('Ctrl+Pavé num. 7');
    expect(hotkeyLabel(parseAccelerator('CommandOrControl+nummult')!)).toBe('Ctrl+Pavé num. *');
    expect(hotkeyLabel(parseAccelerator('CommandOrControl+PageDown')!)).toBe('Ctrl+Page suiv.');
    expect(acceleratorLabel('quelque chose')).toBe('quelque chose');
  });
});
