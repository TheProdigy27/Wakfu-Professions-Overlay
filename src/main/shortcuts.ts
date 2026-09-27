// Raccourci global d'affichage (RegisterHotKey) : Windows l'intercepte, le jeu ne le reçoit pas.
import { globalShortcut } from 'electron';

export type HotkeyResult = 'ok' | 'taken' | 'invalid';

export class ToggleHotkey {
  /** Accélérateur effectivement enregistré, null si aucun. */
  private active: string | null = null;
  private suspended: string | null = null;

  constructor(private readonly action: () => void) {}

  get registered(): boolean {
    return this.active !== null || this.suspended !== null;
  }

  /**
   * Remplace le raccourci. En cas d'échec (déjà pris par une autre application, accélérateur invalide),
   * l'ancien raccourci reste actif.
   */
  set(accelerator: string): HotkeyResult {
    this.resume();
    if (accelerator === this.active) return 'ok';
    let ok: boolean;
    try {
      ok = globalShortcut.register(accelerator, this.action);
    } catch {
      return 'invalid';
    }
    if (!ok) return 'taken';
    if (this.active) globalShortcut.unregister(this.active);
    this.active = accelerator;
    return 'ok';
  }

  /** Pendant la saisie d'un nouveau raccourci : l'actuel ne doit pas masquer le panneau. */
  suspend(): void {
    if (!this.active) return;
    globalShortcut.unregister(this.active);
    this.suspended = this.active;
    this.active = null;
  }

  resume(): void {
    const previous = this.suspended;
    this.suspended = null;
    if (previous && globalShortcut.register(previous, this.action)) this.active = previous;
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.active = null;
    this.suspended = null;
  }
}
