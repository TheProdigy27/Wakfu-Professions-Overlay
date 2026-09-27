// Accueil au premier lancement : raccourci, focus, plein écran, listes, données Ankama.
import { showOnboarding, usePanel } from '../store';

export function Onboarding() {
  const hotkey = usePanel((s) => s.app?.hotkey);
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <h2 id="onboarding-title">Bienvenue</h2>
        <ul>
          <li>
            <strong>Afficher / masquer</strong> : {hotkey?.label ?? 'le raccourci'} (modifiable dans les réglages ⚙), ou un clic
            sur l'icône dans la zone de notification. Le panneau s'affiche sans prendre le clavier du jeu : cliquez dedans pour
            écrire, puis dans le jeu pour y revenir.
          </li>
          <li>
            <strong>Plein écran</strong> : Windows ne peut rien afficher par-dessus un jeu en plein écran exclusif. Réglez
            Wakfu en mode fenêtré ou fenêtré sans bordure.
          </li>
          <li>
            <strong>Vos listes</strong> sont enregistrées au fil de l'eau ; les 10 dernières restent dans « Récents », à
            droite de la recherche.
          </li>
          <li>
            <strong>Données du jeu</strong> : téléchargées depuis les serveurs d'Ankama au premier lancement, puis gardées
            sur ce PC.
          </li>
        </ul>
        <p className="about">Outil non officiel, non affilié à Ankama. Données et icônes © Ankama.</p>
        <button type="button" className="primary" autoFocus onClick={() => showOnboarding(false)}>
          Compris
        </button>
      </div>
    </div>
  );
}
