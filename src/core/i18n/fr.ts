// Textes de l'interface en français. C'est la langue de référence : les autres traductions ont la même forme (Messages).
import type { DataErrorCode } from '../data/dataStatus';
import type { HotkeyProblem } from '../state/hotkey';
import { LOCALE_TAGS } from './locale';

/** Montants en kamas : « 12 400 ». */
const KAMAS = new Intl.NumberFormat(LOCALE_TAGS.fr);

export const fr = {
  common: {
    close: 'Fermer',
    retry: 'Réessayer',
    restartNow: 'Redémarrer maintenant',
    openLog: 'Ouvrir le journal',
    disclaimer: 'Outil non officiel, non affilié à Ankama. Données et icônes © Ankama.',
    /** Badge des recettes d'amélioration (rareté supérieure). */
    upgrade: 'amélioration',
    /** Badge des recettes à apprendre avec un plan. */
    plan: 'plan',
    unknownItem: (id: number) => `Objet inconnu #${id}`,
    percent: (n: number) => `${n} %`,
  },
  header: {
    settings: 'Réglages',
    compactMode: 'Mode compact',
    normalMode: 'Mode normal',
    hide: 'Masquer',
    hideWithHotkey: (hotkey: string) => `Masquer (${hotkey})`,
    back: 'Retour',
    backTitle: 'Retour (Alt+←, ou bouton « précédent » de la souris)',
    /** Icône affichée une fois la nouvelle version de l'application téléchargée. */
    updateReady: (version: string) => `Mise à jour prête !\nCliquez pour installer la version ${version} et redémarrer.`,
  },
  views: { tree: 'Arbre', shopping: 'Courses', order: 'Ordre' },
  body: {
    obsolete: (itemId: number, version: string) =>
      `L'objet de cette liste (#${itemId}) n'existe plus dans les données du jeu ${version}.`,
    obsoleteHint: 'Recherchez un objet de remplacement : cette liste restera dans les listes récentes.',
    noTarget: 'Aucun objet choisi.',
    searchHint: 'Recherchez un objet à crafter par son nom.',
    /** Suivi du nom de l'objet et de la quantité : la liste en cours vient d'être terminée en jeu. */
    crafted: 'Craft terminé :',
    quantity: 'Quantité',
  },
  data: {
    loading: 'Chargement des données du jeu…',
    downloading: (version: string, percent: number) =>
      `Téléchargement des données du jeu ${version} depuis les serveurs d'Ankama : ${percent} %`,
    building: (version: string) => `Préparation des données du jeu ${version}…`,
    /** version : celle que l'on essayait d'installer. */
    errors: {
      'offline-no-data': () => "Connexion requise au premier lancement : les données du jeu n'ont pas encore été téléchargées.",
      format: (version) =>
        `Les données du jeu${version ? ` ${version}` : ''} ont un format que cette version de l'application ne sait pas lire : mettez à jour l'application.`,
      network: (version) => `Téléchargement des données${version ? ` ${version}` : ''} interrompu, nouvel essai plus tard.`,
    } as Record<DataErrorCode, (version: string | null) => string>,
    kept: (version: string) => `Les données ${version} restent utilisées.`,
    footer: {
      version: (version: string) => `Données ${version}`,
      none: 'Aucune donnée',
      offline: 'hors ligne',
      updating: 'mise à jour…',
      updatingPercent: (percent: number) => `mise à jour : ${percent} %`,
      formatFailed: 'mise à jour des données impossible',
      networkFailed: 'téléchargement interrompu',
    },
  },
  banners: {
    storeProblem: {
      corrupt: (file: string) =>
        `Vos listes et réglages n'ont pas pu être relus : le fichier a été mis de côté (${file}) et l'application repart de zéro.`,
      newer: (file: string) =>
        `Vos listes ont été enregistrées par une version plus récente de l'application : elles sont gardées de côté (${file}).`,
    },
    saveError: (detail: string) => `Vos listes et réglages n'ont pas pu être enregistrés (${detail}).`,
    log: 'Journal',
    hotkeyTaken: (hotkey: string) =>
      `${hotkey} est déjà utilisé par une autre application : le panneau ne s'affiche plus au clavier.`,
    chooseHotkey: 'Choisir un autre raccourci',
    recipesChanged: (version: string | undefined) =>
      `Recettes modifiées par la mise à jour du jeu${version ? ` (${version})` : ''} :`,
  },
  /** Recettes modifiées par une mise à jour du jeu, par exemple « Orbe Durable : Krak-Ertz 7 → 8 ». */
  changes: {
    unknownItem: (id: number) => `Objet #${id}`,
    itemRemoved: (name: string) => `${name} : objet retiré du jeu`,
    recipeRemoved: (name: string) => `${name} : la recette choisie n'existe plus, recette par défaut utilisée`,
    recipeChanged: (name: string, parts: string[]) => `${name} : ${parts.join(', ')}`,
    yield: (before: number, after: number) => `rendement ${before} → ${after}`,
    added: (name: string, qty: number) => `${name} ajouté (×${qty})`,
    removed: (name: string, qty: number) => `${name} retiré (×${qty})`,
    quantity: (name: string, before: number, after: number) => `${name} ${before} → ${after}`,
  },
  order: {
    nothing: 'Rien à crafter : tout est en stock ou acheté.',
    step: (n: number) => `Étape ${n}`,
  },
  crash: {
    message: 'Le panneau a rencontré une erreur. Vos listes sont enregistrées.',
    reload: 'Recharger le panneau',
  },
  history: {
    button: 'Récents',
    title: 'Listes récentes',
    empty: 'Aucune liste récente',
    owned: (n: number) => `${n} objet${n > 1 ? 's' : ''} en stock`,
    remove: 'Retirer des listes récentes',
  },
  item: {
    level: (level: number) => `Niv. ${level}`,
    tooltip: (rarity: string, level: number) => `${rarity}, niv. ${level}`,
    harvestTitle: 'Métier de récolte et niveau requis',
    /** plan : nom de l'objet, par exemple « Plan "Kokordon" ». */
    needsPlan: (plan: string) => `Nécessite : ${plan}`,
    planTitle: 'Objet à utiliser une fois pour apprendre cette recette',
    /** Icône à côté du nom : le copie, pour le coller dans une recherche du jeu. */
    copyName: 'Copier le nom',
    nameCopied: 'Nom copié',
  },
  /** Par numéro de rareté (rarity.ts). */
  rarities: ['Ancien Objet', 'Commun', 'Rare', 'Mythique', 'Légendaire', 'Relique', 'Souvenir', 'Épique'] as readonly string[],
  unknownRarity: (rarity: number) => `Rareté ${rarity}`,
  onboarding: {
    title: 'Bienvenue',
    /** [texte en gras, suite de la phrase] */
    tips: (hotkey: string | undefined): [string, string][] => [
      [
        'Afficher / masquer',
        ` : ${hotkey ?? 'le raccourci'} (modifiable dans les réglages ⚙), ou un clic sur l'icône dans la zone de notification. Le panneau s'affiche sans prendre le clavier du jeu : cliquez dedans pour écrire, puis dans le jeu pour y revenir.`,
      ],
      [
        'Plein écran',
        ' : Windows ne peut rien afficher par-dessus un jeu en plein écran exclusif. Réglez Wakfu en mode fenêtré ou fenêtré sans bordure.',
      ],
      ['Vos listes', " sont enregistrées au fil de l'eau ; les 10 dernières restent dans « Récents », à droite de la recherche."],
      ['Données du jeu', " : téléchargées depuis les serveurs d'Ankama au premier lancement, puis gardées sur ce PC."],
    ],
    ok: 'Compris',
  },
  search: {
    placeholder: 'Rechercher un objet…',
    loading: 'Données du jeu en cours de chargement…',
    none: 'Aucun objet trouvé',
  },
  /** Crafts par métier. */
  jobs: {
    button: 'Métiers',
    title: 'Crafts par métier',
    job: 'Métier',
    level: 'Mon niveau',
    levelTitle: 'Seulement les crafts de ce niveau de métier ou moins (mémorisé pour chaque métier)',
    allLevels: 'tous',
    filter: 'Filtrer par nom…',
    upgrades: 'Améliorations',
    upgradesTitle: "Recettes d'amélioration (rareté supérieure)",
    count: (shown: number, total: number) =>
      shown === total ? `${total} craft${total > 1 ? 's' : ''}` : `${shown} craft${shown > 1 ? 's' : ''} sur ${total}`,
    none: 'Aucun craft ne correspond.',
    choose: 'Préparer ce craft',
  },
  settings: {
    title: 'Réglages',
    language: 'Langue',
    hotkey: 'Afficher / masquer le panneau',
    display: 'Affichage',
    opacity: 'Opacité',
    startup: 'Démarrage et mises à jour',
    launchAtLogin: 'Lancer avec Windows (panneau masqué, dans la zone de notification)',
    showWithWakfu: 'Afficher le panneau au lancement de Wakfu, le masquer à sa fermeture',
    showWithWakfuHint: "Fonctionne quand l'application est lancée : cochez aussi « Lancer avec Windows » pour qu'elle attende le jeu.",
    autoUpdate: "Installer automatiquement les mises à jour de l'application",
    packagedOnly: "Disponible dans la version installée de l'application.",
    owned: 'Quantités possédées',
    ownedFromChat: 'Les mettre à jour avec le chat de Wakfu : objets ramassés, craftés, achetés ou vendus',
    ownedFromChatHint:
      "Pour les objets de la liste en cours, dès que l'option est cochée. Une fois l'objet visé crafté, sa liste quitte l'écran et les récents. Ce que vous aviez déjà (inventaire, banque) et les échanges entre joueurs restent à indiquer à la main.",
    performance: 'Performances',
    hardwareAcceleration: 'Accélération matérielle',
    nextStart: 'Prise en compte au prochain démarrage.',
    help: 'Aide',
    showOnboarding: "Revoir l'accueil",
    appFolder: "Dossier de l'application",
    dataVersion: (version: string) => `données du jeu ${version}`,
  },
  update: {
    check: 'Rechercher une mise à jour',
    checking: "Recherche d'une mise à jour…",
    latest: 'Vous avez la dernière version.',
    downloading: (version: string, percent: number) => `Téléchargement de la version ${version} : ${percent} %`,
    ready: (version: string, autoInstall: boolean) =>
      `Version ${version} prête${autoInstall ? ", installée à la fermeture de l'application" : ''}.`,
    install: 'Installer et redémarrer',
    errors: {
      check: 'Recherche de mise à jour impossible : réseau indisponible ou GitHub injoignable.',
      publishing: 'Une nouvelle version est en cours de publication : réessayez dans quelques minutes.',
      'not-published': "Aucune version publiée n'a été trouvée sur GitHub.",
    },
    downloadFailed: (version: string) => `Téléchargement de la version ${version} interrompu.`,
  },
  hotkey: {
    capturing: 'Appuyez sur la combinaison… (Échap : annuler)',
    change: 'Modifier',
    taken: (hotkey: string) => `${hotkey} est déjà utilisé par une autre application.`,
    hint: 'Fonctionne même quand le jeu a le focus ; le jeu ne reçoit pas cette combinaison.',
    problems: {
      'unsupported-key':
        'Touche non prise en charge : utilisez une lettre, un chiffre, F1 à F24, le pavé numérique ou une touche de navigation.',
      'no-modifier': 'Ajoutez Ctrl ou Alt : sans eux, la touche serait bloquée dans toutes les applications, jeu compris.',
      altgr: 'Ctrl+Alt équivaut à AltGr : cette combinaison empêcherait de taper des caractères comme @, € ou #. Ajoutez Maj.',
      'single-modifier':
        'Une seule touche de modification avec une lettre ou un chiffre est déjà utilisée par la plupart des applications : ajoutez Maj.',
    } as Record<HotkeyProblem, string>,
    invalid: 'Raccourci invalide.',
    takenChooseAnother: (hotkey: string) => `${hotkey} est déjà utilisé par une autre application : choisissez-en un autre.`,
    notGlobal: (hotkey: string) => `${hotkey} ne peut pas servir de raccourci global.`,
    /** Libellés d'un clavier français : « Ctrl+Maj+W ». */
    modifiers: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Maj', meta: 'Win' },
    keys: {
      Space: 'Espace',
      PageUp: 'Page préc.',
      PageDown: 'Page suiv.',
      End: 'Fin',
      Home: 'Début',
      Left: 'Gauche',
      Up: 'Haut',
      Right: 'Droite',
      Down: 'Bas',
      Insert: 'Inser',
      Delete: 'Suppr',
    },
    numpad: (key: string) => `Pavé num. ${key}`,
  },
  shopping: {
    missingOnly: 'Seulement ce qui manque',
    nothingMissing: 'Rien ne manque : vous avez tout.',
    nothingToGet: 'Aucune ressource à obtenir.',
    resources: 'Ressources',
    bought: 'Intermédiaires achetés',
    copy: 'Copier',
    copied: 'Copié ✓',
    copyTitle: 'Copier ce qui reste à obtenir dans le presse-papiers',
    columns: { item: 'Objet', required: 'Requis', owned: 'Possédé', missing: 'Reste' },
    have: (qty: number) => `Je l'ai (${qty})`,
    ownedLabel: 'Quantité possédée',
    missingTitle: (required: number) => `Reste à obtenir (sur ${required})`,
    /** Texte copié : « Coiffe Lardante (Légendaire) ×1 : liste de courses ». */
    textTitle: (target: string) => `${target} : liste de courses`,
    textNothing: 'Rien ne manque.',
  },
  tree: {
    recipe: (job: string, level: number) => `${job} niv. ${level}`,
    unknownJob: (id: number) => `Métier #${id}`,
    crafts: (n: number) => `${n} craft${n > 1 ? 's' : ''}`,
    perCraft: (n: number) => `(${n} par craft)`,
    fromStock: (n: number) => `${n} en stock`,
    stock: 'En stock',
    toObtain: (n: number) => `À obtenir : ${n}`,
    toBuy: (n: number) => `À acheter : ${n}`,
    cycle: (n: number) => `Recette circulaire, à obtenir : ${n}`,
    expand: 'Déplier',
    collapse: 'Replier',
    haveTotal: (n: number) => `Je l'ai (${n} au total)`,
    modeTitle: 'Crafter ou acheter cet intermédiaire',
    craft: 'Je le crafte',
    buy: "J'achète",
    variantTitle: 'Variante de recette (le choix est mémorisé pour cet objet)',
    variant: (n: number, isDefault: boolean, ingredients: string) =>
      `Variante ${n}${isDefault ? ' (par défaut)' : ''} : ${ingredients}`,
  },
  /** Prix de l'HDV saisis à la main, coût de revient et comparaison crafter / acheter. */
  cost: {
    kamas: (n: number) => `${KAMAS.format(n)}\u00a0kamas`,
    /** Des objets n'ont pas encore de prix : le montant n'est qu'un minimum. */
    atLeast: (amount: string) => `≥\u00a0${amount}`,
    /** Aucun des objets concernés n'a de prix. */
    unknown: '?',
    total: (amount: string) => `Coût de revient : ${amount}`,
    unpriced: (n: number) => `${n} sans prix`,
    unpricedTitle: (names: string) => `Sans prix : ${names}`,
    craft: (amount: string) => `Crafter : ${amount}`,
    buy: (amount: string) => `Acheter : ${amount}`,
    /** Objet présent à plusieurs endroits de l'arbre : la comparaison porte sur toute la liste. */
    inList: (qty: number) => `×${qty} dans la liste`,
    compareTitle: (qty: number) =>
      `Pour ×${qty} dans toute la liste. Crafter : les ingrédients qui restent à obtenir, ce que vous possédez ne coûte rien. Le moins cher est en vert.`,
    column: 'Prix',
    columnTitle: "Prix unitaire à l'Hôtel de vente, en kamas",
    /** Case à droite des onglets : affiche ou masque les champs des prix. */
    toggle: 'Prix',
    toggleTitle: "Afficher les champs pour saisir les prix de l'Hôtel de vente",
    price: "Prix unitaire à l'Hôtel de vente, en kamas (0 pour ce que vous récoltez vous-même)",
    age: (days: number) => (days === 0 ? "Saisi aujourd'hui" : days === 1 ? 'Saisi hier' : `Saisi il y a ${days} jours`),
    line: (qty: number, amount: string) => `${qty} à obtenir : ${amount}`,
  },
  tray: {
    tooltip: 'Wakfu Professions Overlay',
    installUpdate: (version: string) => `Installer la version ${version} et redémarrer`,
    toggle: 'Afficher / masquer le panneau',
    toggleWithHotkey: (hotkey: string) => `Afficher / masquer le panneau (${hotkey})`,
    compactMode: 'Mode compact',
    settings: 'Réglages…',
    checkData: 'Vérifier les données du jeu',
    openLog: 'Ouvrir le journal',
    help: "Le panneau n'apparaît pas ?",
    quit: 'Quitter',
  },
  /** Aide du menu « Le panneau n'apparaît pas ? » : plein écran exclusif, raccourci pris. */
  help: {
    message: "Le panneau n'apparaît pas ?",
    detail: (hotkeyLine: string) =>
      "En plein écran exclusif, Windows ne peut rien afficher par-dessus le jeu. Dans les options de Wakfu, passez en mode fenêtré (ou fenêtré sans bordure), puis réaffichez le panneau.\n\n" +
      `${hotkeyLine} Un clic sur cette icône, dans la zone de notification, fait de même.`,
    hotkeyOk: (hotkey: string) => `Le raccourci ${hotkey} affiche ou masque le panneau.`,
    hotkeyTaken: (hotkey: string) =>
      `Le raccourci ${hotkey} est déjà utilisé par une autre application : choisissez-en un autre dans les réglages du panneau.`,
    show: 'Afficher le panneau',
    close: 'Fermer',
  },
  hotkeyBalloon: {
    title: 'Raccourci indisponible',
    content: (hotkey: string) =>
      `${hotkey} est déjà utilisé par une autre application. Choisissez-en un autre dans les réglages du panneau.`,
  },
};

export type Messages = typeof fr;
