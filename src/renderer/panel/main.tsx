import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initStore } from './store';
import './styles.css';

// Erreurs hors rendu React : dans le journal du processus principal (logs/main.log).
window.addEventListener('error', (event) => window.api.log(`erreur : ${event.message} (${event.filename}:${event.lineno})`));
window.addEventListener('unhandledrejection', (event) => {
  const reason: unknown = event.reason;
  window.api.log(`promesse rejetée : ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
void initStore();
