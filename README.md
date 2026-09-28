<img src="resources/icon.png" alt="" width="96" align="right">

# Wakfu Professions Overlay

**Français** · [English](README.en.md)

Panneau de préparation de craft pour **Wakfu**, affiché par-dessus le jeu : vous cherchez un objet, il vous montre tout ce qu'il faut réunir pour le fabriquer.

> **Outil non officiel, non affilié à Ankama.** Wakfu est une marque d'Ankama. Les données et les icônes du jeu (© Ankama) sont téléchargées depuis les serveurs publics d'Ankama sur votre PC ; elles ne sont ni incluses dans ce dépôt ni dans l'installeur.

## Ce que fait l'application

- **Recherche** d'un objet par son nom (tolérante aux fautes de frappe) ou son identifiant (`#29236`), avec une ligne par rareté.
- **Crafts par métier** (bouton « Métiers ») : tout ce qu'un métier fabrique, rangé par niveau. Indiquez votre niveau, mémorisé pour chaque métier, pour ne voir que les crafts qui vous sont accessibles. Un clic prépare le craft.
- **Arbre** de craft complet, sur autant de niveaux que nécessaire (intermédiaires compris).
- **Liste de courses** agrégée : ce qu'il faut, ce que vous avez déjà, ce qui manque. Copie dans le presse-papiers.
- **Provenance des ressources** récoltées : le métier et le niveau requis, par exemple « Mineur niv. 15 » à côté du Minerai de Cuivre. Les données du jeu ne disent pas quels monstres font tomber les autres ressources.
- **Ordre de craft** : les intermédiaires d'abord, avec le métier et le niveau requis.
- **Plans** : un craft qu'il faut d'abord apprendre l'indique, avec le nom du plan à utiliser, par exemple « Nécessite : Plan "Kokordon" ».
- Case **« je l'ai »** et quantités possédées, choix **crafter / acheter** pour chaque intermédiaire, choix de la **variante** de recette quand il y en a plusieurs.
- **Prix de l'Hôtel de vente**, saisis à la main (colonne « Prix » des courses, ou dans l'arbre) et gardés pour toutes les listes : coût de revient de la liste, et pour chaque objet à crafter « Crafter : … · Acheter : … », le moins cher en vert. Ce que vous possédez déjà ne coûte rien ; mettez 0 pour ce que vous récoltez vous-même. Un prix saisi il y a plus d'une semaine s'affiche en gris.
- **Quantités mises à jour en jeu** (option des réglages) : les objets de la liste que vous ramassez, craftez, achetez ou vendez s'ajoutent ou se retirent tout seuls, d'après le chat de Wakfu, et la case « je l'ai » se coche dès que vous avez le compte. Ce que vous aviez déjà (inventaire, banque) et les échanges entre joueurs restent à indiquer à la main.
- Mode **compact**, **opacité** réglable, **raccourci** global (`Ctrl+Maj+W` par défaut) pour afficher ou masquer le panneau sans quitter le jeu.
- Interface en **français, anglais, espagnol et portugais**. Les noms des objets suivent la langue choisie : ils viennent directement des données du jeu.
- Listes enregistrées au fil de l'eau ; les 10 dernières restent dans « Récents ».

## Ce qu'elle ne fait pas

L'application **n'interagit jamais avec le jeu** : elle ne lit ni son écran ni sa mémoire ; elle n'intercepte pas son trafic réseau et ne simule aucune touche. Elle se contente d'afficher une fenêtre au premier plan.

Le raccourci global est intercepté par Windows : le jeu ne le reçoit pas. Choisissez une combinaison que vous n'utilisez pas dans Wakfu.

## Installation

1. Téléchargez `Wakfu-Professions-Overlay-Setup-<version>.exe` depuis la page [Releases](https://github.com/TheProdigy27/Wakfu-Professions-Overlay/releases/latest).
2. Lancez-le. L'installeur **n'est pas signé** : Windows SmartScreen peut afficher « Windows a protégé votre ordinateur ». Cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.
3. L'application s'installe pour votre compte Windows seulement, **sans droits d'administrateur**, dans `%LOCALAPPDATA%\Programs\`.

Au premier lancement, elle télécharge les données du jeu depuis les serveurs d'Ankama (environ 9 Mo, progression affichée). Elle fonctionne ensuite **hors ligne**, et revérifie la version des données au démarrage.

Configuration requise : Windows 10 ou 11, 64 bits. Comptez environ 400 Mo de mémoire vive (Electron).

## Utilisation

- **Afficher / masquer** : `Ctrl+Maj+W`, ou un clic sur l'icône dans la zone de notification. Le panneau s'affiche sans prendre le clavier du jeu : cliquez dedans pour écrire, puis dans le jeu pour y revenir.
- **Le panneau n'apparaît pas ?** En plein écran exclusif, Windows ne peut rien afficher par-dessus le jeu. Dans les options de Wakfu, passez en mode **fenêtré** ou **fenêtré sans bordure**.
- **Langue** : au démarrage, celle de Windows (l'anglais si ce n'est pas l'une des quatre ci-dessus). Elle se change dans les réglages, ou dès l'écran d'accueil.
- **Avec Wakfu** : cochez « Afficher le panneau au lancement de Wakfu » dans les réglages. L'application démarre alors avec Windows et attend dans la zone de notification ; le panneau s'affiche quand le jeu démarre et se masque à sa fermeture.
- **Retour** (← en haut à gauche, `Alt+←` ou le bouton « précédent » de la souris) : revient à l'écran d'avant, par exemple aux Métiers après un clic de trop. Un objet ouvert par erreur puis quitté ainsi, sans rien y modifier, ne reste pas dans « Récents ».
- **Réglages** (⚙) : langue, raccourci, opacité, quantités mises à jour avec le chat de Wakfu, lancement avec Windows ou avec Wakfu, mises à jour, accélération matérielle.
- **Journal** : menu de l'icône dans la zone de notification, « Ouvrir le journal ».

## Mises à jour

L'application vérifie au démarrage si une nouvelle version est publiée sur GitHub, la télécharge en arrière-plan et l'installe à la fermeture (ou tout de suite avec « Redémarrer maintenant »). Vous pouvez désactiver l'installation automatique dans les réglages ; la recherche manuelle reste possible.

Les données du jeu se mettent à jour d'elles-mêmes après une mise à jour de Wakfu. Si une recette de vos listes a changé, un bandeau l'indique.

## Désinstallation

Paramètres Windows › Applications › Applications installées › **Wakfu Professions Overlay** › Désinstaller. Le désinstalleur vous demande s'il faut aussi supprimer vos listes, vos réglages et les données téléchargées (`%APPDATA%\Wakfu Professions Overlay`) ; répondez Non pour les retrouver après une réinstallation.

## Vie privée

Aucune télémétrie, aucun compte. L'application ne contacte que :

- `wakfu.cdn.ankama.com` et `static.ankama.com` : données et icônes du jeu ;
- `github.com` : recherche et téléchargement des mises à jour de l'application.

Tout le reste (listes, réglages, journal) reste sur votre PC, dans `%APPDATA%\Wakfu Professions Overlay`.

Avec l'option « quantités mises à jour avec le chat de Wakfu », l'application lit aussi le chat que Wakfu écrit sur votre PC (`%APPDATA%\zaap\gamesLogs\wakfu\logs\wakfu_chat.log`). Seules les lignes d'objets ramassés ou perdus lui servent ; rien de ce chat n'est enregistré ni envoyé.

## Licence

Code sous licence [MIT](LICENSE). La licence ne couvre pas les données ni les icônes du jeu, qui restent la propriété d'Ankama.
