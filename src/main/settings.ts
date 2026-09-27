// Réglages : raccourci, lancement avec Windows, mises à jour, accélération matérielle, accueil.
import { app } from 'electron';
import { acceleratorLabel, comboProblem, DEFAULT_HOTKEY, parseAccelerator } from '../core/state/hotkey';
import type { Settings } from '../core/state/schema';
import { BOOLEAN_OPTIONS, type AppState, type BooleanOption, type HotkeyChange } from '../preload/api';
import type { ToggleHotkey } from './shortcuts';
import type { JsonStore } from './store/jsonStore';

/** Argument du lancement avec Windows : l'application démarre dans la zone de notification, panneau masqué. */
export const HIDDEN_ARG = '--hidden';

function hotkeyProblem(accelerator: string): string | null {
  const combo = parseAccelerator(accelerator);
  return combo ? comboProblem(combo) : 'Raccourci invalide.';
}

export class SettingsController {
  private readonly listeners = new Set<(state: AppState) => void>();
  /** Valeur au démarrage : app.disableHardwareAcceleration() ne s'applique qu'avant app.whenReady(). */
  private readonly hardwareAccelerationActive: boolean;

  constructor(
    private readonly store: JsonStore,
    private readonly hotkey: ToggleHotkey,
    private readonly log: (message: string) => void,
  ) {
    this.hardwareAccelerationActive = store.get().settings.hardwareAcceleration;
    store.onSaveError(() => this.emit());
  }

  get settings(): Settings {
    return this.store.get().settings;
  }

  get hotkeyLabel(): string {
    return acceleratorLabel(this.settings.hotkeys.toggle);
  }

  get state(): AppState {
    const s = this.settings;
    return {
      hotkey: { accelerator: s.hotkeys.toggle, label: this.hotkeyLabel, registered: this.hotkey.registered },
      launchAtLogin: s.launchAtLogin,
      autoUpdate: s.autoUpdate,
      hardwareAcceleration: s.hardwareAcceleration,
      hardwareAccelerationActive: this.hardwareAccelerationActive,
      onboardingDone: s.onboardingDone,
      packaged: app.isPackaged,
      version: app.getVersion(),
      storeProblem: this.store.loadProblem,
      saveError: this.store.saveError,
    };
  }

  onChange(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Au démarrage : enregistre le raccourci mémorisé ; false s'il est déjà pris par une autre application. */
  start(): boolean {
    let accelerator = this.settings.hotkeys.toggle;
    if (hotkeyProblem(accelerator)) {
      this.log(`raccourci mémorisé ${accelerator} refusé : retour à ${DEFAULT_HOTKEY}`);
      accelerator = DEFAULT_HOTKEY;
      this.patch({ hotkeys: { toggle: accelerator } });
    }
    const result = this.hotkey.set(accelerator);
    if (result !== 'ok') this.log(`raccourci ${accelerator} : ${result === 'taken' ? 'déjà utilisé par une autre application' : 'invalide'}`);
    this.applyLoginItem();
    this.emit();
    return result === 'ok';
  }

  /** Nouveau raccourci, saisi dans les réglages. S'il est refusé, l'ancien reste en place. */
  setHotkey(accelerator: unknown): HotkeyChange {
    if (typeof accelerator !== 'string') return { ok: false, message: 'Raccourci invalide.' };
    const problem = hotkeyProblem(accelerator);
    if (problem) return { ok: false, message: problem };
    const label = acceleratorLabel(accelerator);
    const result = this.hotkey.set(accelerator);
    this.emit();
    if (result === 'taken') {
      this.log(`raccourci ${accelerator} : déjà utilisé par une autre application`);
      return { ok: false, message: `${label} est déjà utilisé par une autre application : choisissez-en un autre.` };
    }
    if (result === 'invalid') return { ok: false, message: `${label} ne peut pas servir de raccourci global.` };
    if (accelerator !== this.settings.hotkeys.toggle) this.log(`raccourci : ${accelerator}`);
    this.patch({ hotkeys: { toggle: accelerator } });
    return { ok: true };
  }

  suspendHotkey(suspended: boolean): void {
    if (suspended) this.hotkey.suspend();
    else this.hotkey.resume();
  }

  setOption(name: unknown, value: unknown): void {
    if (!BOOLEAN_OPTIONS.includes(name as BooleanOption) || typeof value !== 'boolean') return;
    this.patch({ [name as BooleanOption]: value });
    if (name === 'launchAtLogin') this.applyLoginItem();
  }

  completeOnboarding(): void {
    this.patch({ onboardingDone: true });
  }

  /** Seulement pour l'application installée : en développement, on n'inscrirait qu'electron.exe. */
  private applyLoginItem(): void {
    if (!app.isPackaged) return;
    app.setLoginItemSettings({ openAtLogin: this.settings.launchAtLogin, args: [HIDDEN_ARG] });
  }

  private patch(patch: Partial<Settings>): void {
    this.store.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    this.emit();
  }

  private emit(): void {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }
}
