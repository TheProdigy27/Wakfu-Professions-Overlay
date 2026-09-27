; Ajouts à l'installeur NSIS d'electron-builder (electron-builder.yml, nsis.include). Fichier lu en UTF-8.

; Page d'accueil : ce qu'est l'application et avertissement « non officiel ».
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "${PRODUCT_NAME} ${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "Panneau de préparation de craft pour Wakfu : arbre des ingrédients, liste de courses et ordre de craft.$\r$\n$\r$\nOutil non officiel, non affilié à Ankama. Il ne lit ni l'écran ni la mémoire du jeu et n'interagit jamais avec lui.$\r$\n$\r$\nLes données du jeu et les icônes (© Ankama) sont téléchargées depuis les serveurs d'Ankama au premier lancement.$\r$\n$\r$\nL'application s'installe pour votre compte Windows seulement, sans droits d'administrateur. Cliquez sur Suivant pour l'installer."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Toujours pour l'utilisateur courant (%LOCALAPPDATA%\Programs), sans droits d'administrateur ni page de choix :
; les mises à jour automatiques s'installent alors sans demande d'élévation.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; Désinstallation demandée par l'utilisateur (pas lors d'une mise à jour) : garder ou supprimer les listes, les réglages
; et les données du jeu téléchargées (%APPDATA%\Wakfu Professions Overlay). En mode silencieux (/S), elles sont gardées.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Supprimer aussi vos listes, vos réglages et les données du jeu téléchargées ?$\r$\n$\r$\nChoisissez Non pour les conserver en vue d'une réinstallation." /SD IDNO IDNO wpoKeepAppData
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
    wpoKeepAppData:
    ; Mise à jour téléchargée par electron-updater et pas encore installée : sans objet une fois l'application désinstallée.
    RMDir /r "$LOCALAPPDATA\${APP_PACKAGE_NAME}-updater"
  ${endIf}
!macroend
