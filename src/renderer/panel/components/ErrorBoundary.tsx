// Erreur d'affichage : message et rechargement plutôt qu'un panneau vide ; le détail va dans le journal.
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    window.api.log(`erreur d'affichage : ${error.stack ?? error.message}${info.componentStack ?? ''}`);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <p>Le panneau a rencontré une erreur. Vos listes sont enregistrées.</p>
        <div className="buttons">
          <button type="button" className="primary" onClick={() => location.reload()}>
            Recharger le panneau
          </button>
          <button type="button" onClick={() => window.api.openLog()}>
            Ouvrir le journal
          </button>
        </div>
      </div>
    );
  }
}
