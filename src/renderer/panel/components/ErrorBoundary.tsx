// Erreur d'affichage : message et rechargement plutôt qu'un panneau vide ; le détail va dans le journal.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { messages } from '../../../core/i18n';
import { currentLocale } from '../store';

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
    const m = messages(currentLocale());
    return (
      <div className="crash">
        <p>{m.crash.message}</p>
        <div className="buttons">
          <button type="button" className="primary" onClick={() => location.reload()}>
            {m.crash.reload}
          </button>
          <button type="button" onClick={() => window.api.openLog()}>
            {m.common.openLog}
          </button>
        </div>
      </div>
    );
  }
}
