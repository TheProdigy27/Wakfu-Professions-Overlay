; Ajouts à l'installeur NSIS d'electron-builder (electron-builder.yml, nsis.include). Fichier lu en UTF-8.

; Textes propres à cet installeur, dans ses quatre langues (electron-builder.yml, installerLanguages) : français (1036),
; anglais (1033), espagnol (3082) et portugais du Brésil (1046). La langue est celle de Windows, l'anglais à défaut.
LangString wpoWelcomeText 1036 "Panneau de préparation de craft pour Wakfu : arbre des ingrédients, liste de courses et ordre de craft.$\r$\n$\r$\nOutil non officiel, non affilié à Ankama. Il ne lit ni l'écran ni la mémoire du jeu et n'interagit jamais avec lui.$\r$\n$\r$\nLes données du jeu et les icônes (© Ankama) sont téléchargées depuis les serveurs d'Ankama au premier lancement.$\r$\n$\r$\nL'application s'installe pour votre compte Windows seulement, sans droits d'administrateur. Cliquez sur Suivant pour l'installer."
LangString wpoWelcomeText 1033 "Craft preparation panel for Wakfu: ingredient tree, shopping list and craft order.$\r$\n$\r$\nUnofficial tool, not affiliated with Ankama. It never reads the game's screen or memory and never interacts with the game.$\r$\n$\r$\nGame data and icons (© Ankama) are downloaded from Ankama's servers on first launch.$\r$\n$\r$\nThe app is installed for your Windows account only, without administrator rights. Click Next to install it."
LangString wpoWelcomeText 3082 "Panel de preparación de fabricación para Wakfu: árbol de ingredientes, lista de compras y orden de fabricación.$\r$\n$\r$\nHerramienta no oficial, no afiliada a Ankama. No lee la pantalla ni la memoria del juego y nunca interactúa con él.$\r$\n$\r$\nLos datos y los iconos del juego (© Ankama) se descargan de los servidores de Ankama en el primer inicio.$\r$\n$\r$\nLa aplicación se instala solo para tu cuenta de Windows, sin derechos de administrador. Haz clic en Siguiente para instalarla."
LangString wpoWelcomeText 1046 "Painel de preparação de fabricação para Wakfu: árvore de ingredientes, lista de compras e ordem de fabricação.$\r$\n$\r$\nFerramenta não oficial, não afiliada à Ankama. Ela não lê a tela nem a memória do jogo e nunca interage com ele.$\r$\n$\r$\nOs dados e os ícones do jogo (© Ankama) são baixados dos servidores da Ankama na primeira execução.$\r$\n$\r$\nO aplicativo é instalado apenas para a sua conta do Windows, sem direitos de administrador. Clique em Avançar para instalá-lo."

LangString wpoRemoveData 1036 "Supprimer aussi vos listes, vos réglages et les données du jeu téléchargées ?$\r$\n$\r$\nChoisissez Non pour les conserver en vue d'une réinstallation."
LangString wpoRemoveData 1033 "Also delete your lists, your settings and the downloaded game data?$\r$\n$\r$\nChoose No to keep them for a reinstallation."
LangString wpoRemoveData 3082 "¿Eliminar también tus listas, tus ajustes y los datos del juego descargados?$\r$\n$\r$\nElige No para conservarlos de cara a una reinstalación."
LangString wpoRemoveData 1046 "Excluir também suas listas, suas configurações e os dados do jogo baixados?$\r$\n$\r$\nEscolha Não para mantê-los para uma reinstalação."

; Page d'accueil : ce qu'est l'application et avertissement « non officiel ».
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "${PRODUCT_NAME} ${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "$(wpoWelcomeText)"
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
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(wpoRemoveData)" /SD IDNO IDNO wpoKeepAppData
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
    wpoKeepAppData:
    ; Mise à jour téléchargée par electron-updater et pas encore installée : sans objet une fois l'application désinstallée.
    RMDir /r "$LOCALAPPDATA\${APP_PACKAGE_NAME}-updater"
  ${endIf}
!macroend
