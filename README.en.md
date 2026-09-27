<img src="resources/icon.png" alt="" width="96" align="right">

# Wakfu Professions Overlay

[Français](README.md) · **English**

A craft preparation panel for **Wakfu**, shown on top of the game: search for an item, and it shows you everything you need to gather to craft it.

> **Unofficial tool, not affiliated with Ankama.** Wakfu is a trademark of Ankama. The game data and icons (© Ankama) are downloaded from Ankama's public servers to your PC; they are included neither in this repository nor in the installer.

## What it does

- **Search** for an item by name (typo-tolerant) or by ID (`#29236`), with one line per rarity.
- Full craft **tree**, as many levels deep as needed (intermediates included).
- Combined **shopping list**: what you need, what you already have, what is missing. Copy it to the clipboard.
- **Where resources come from**: the gathering profession and required level, for example "Miner lvl. 15" next to Copper Ore. The game data does not say which monsters drop the other resources.
- **Craft order**: intermediates first, with the profession and level required.
- **"I have it"** checkbox and owned quantities, **craft / buy** choice for each intermediate, choice of recipe **variant** when there are several.
- **Compact** mode, adjustable **opacity**, global **shortcut** (`Ctrl+Shift+W` by default) to show or hide the panel without leaving the game.
- Interface in **English, French, Spanish and Portuguese**. Item names follow the language you choose: they come straight from the game data.
- Lists are saved as you go; the last 10 stay under "Recent".

## What it does not do

The app **never interacts with the game**: it does not read its screen, memory or files; it does not intercept its network traffic and does not simulate any key press. It only displays a window on top.

The global shortcut is intercepted by Windows: the game does not receive it. Choose a combination you do not use in Wakfu.

## Installation

1. Download `Wakfu-Professions-Overlay-Setup-<version>.exe` from the [Releases](https://github.com/TheProdigy27/Wakfu-Professions-Overlay/releases/latest) page.
2. Run it. The installer is **not signed**: Windows SmartScreen may show "Windows protected your PC". Click **More info**, then **Run anyway**.
3. The app installs for your Windows account only, **without administrator rights**, in `%LOCALAPPDATA%\Programs\`.

On first launch, it downloads the game data from Ankama's servers (about 9 MB, progress shown). It then works **offline**, and checks the data version again at startup.

Requirements: Windows 10 or 11, 64-bit. Expect about 400 MB of RAM (Electron).

## Usage

- **Show / hide**: `Ctrl+Shift+W`, or click the icon in the notification area. The panel appears without taking the keyboard away from the game: click inside it to type, then click the game to go back.
- **Panel not showing?** In exclusive full screen, Windows cannot display anything over the game. In Wakfu's options, switch to **windowed** or **borderless windowed** mode.
- **Language**: the app starts in your Windows language (English if it is not one of the four above). Change it in the settings, or right away on the welcome screen.
- **With Wakfu**: tick "Show the panel when Wakfu starts" in the settings. The app then launches with Windows and waits in the notification area; the panel appears when the game starts and hides when it closes.
- **Settings** (⚙): language, shortcut, opacity, launch with Windows or with Wakfu, updates, hardware acceleration.
- **Log**: notification area icon menu, "Open log".

## Updates

At startup, the app checks whether a new version has been published on GitHub, downloads it in the background and installs it when you quit (or right away with "Restart now"). You can turn off automatic installation in the settings; checking manually is still possible.

The game data updates itself after a Wakfu update. If a recipe in one of your lists has changed, a banner tells you.

## Uninstall

Windows Settings › Apps › Installed apps › **Wakfu Professions Overlay** › Uninstall. The uninstaller asks whether to also delete your lists, your settings and the downloaded data (`%APPDATA%\Wakfu Professions Overlay`); answer No to find them again after reinstalling.

## Privacy

No telemetry, no account. The app only contacts:

- `wakfu.cdn.ankama.com` and `static.ankama.com`: game data and icons;
- `github.com`: checking for and downloading app updates.

Everything else (lists, settings, log) stays on your PC, in `%APPDATA%\Wakfu Professions Overlay`.

## License

Code under the [MIT](LICENSE) license. The license does not cover the game data or icons, which remain the property of Ankama.
