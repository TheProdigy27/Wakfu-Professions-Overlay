// Vérifie l'application empaquetée (release/) avant publication :
// - aucune donnée ni icône Ankama : l'archive app.asar ne contient que le code assemblé (out/, .js/.cjs/.css/.html,
//   plus l'icône de l'application), package.json et les dépendances de production, sans image ni fichier JSON autre
//   que leurs package.json ;
// - rien d'autre à côté de app.asar que ce qu'electron-builder y met ;
// - installeur de 120 Mo au plus, et latest.yml qui le désigne (mises à jour automatiques).
// Usage : npm run package (après electron-builder).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { listPackage } from '@electron/asar';

const ROOT = path.resolve(import.meta.dirname, '..');
const RELEASE = path.join(ROOT, 'release');
const RESOURCES = path.join(RELEASE, 'win-unpacked', 'resources');
const MAX_INSTALLER_BYTES = 120 * 1024 * 1024;
/** Seule image admise : l'icône de l'application, hors de l'archive (app.asar.unpacked) pour que Windows la lise. */
const APP_ICON = '/resources/icon.ico';

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  version: string;
  dependencies: Record<string, string>;
};
const problems: string[] = [];

// ---------------------------------------------------------------- app.asar

const entries = listPackage(path.join(RESOURCES, 'app.asar'), { isPack: false }).map((f) => f.replace(/\\/g, '/'));
// listPackage mêle fichiers et dossiers : un dossier est le parent d'une autre entrée.
const dirs = new Set(entries.map((f) => f.slice(0, f.lastIndexOf('/'))));
const files = entries.filter((f) => !dirs.has(f));
const packages = new Set<string>();
for (const file of files) {
  const dep = /^\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(file);
  if (dep) {
    packages.add(dep[1]!);
    if (/\.(png|jpe?g|gif|webp|ico|bmp)$/i.test(file)) problems.push(`image dans une dépendance : ${file}`);
    if (file.endsWith('.json') && !file.endsWith('/package.json')) problems.push(`JSON inattendu : ${file}`);
  } else if (file.startsWith('/out/')) {
    if (!/\.(js|cjs|css|html)$/.test(file)) problems.push(`fichier inattendu dans out/ : ${file}`);
  } else if (file !== '/package.json' && file !== APP_ICON) {
    problems.push(`fichier hors de out/ et node_modules/ : ${file}`);
  }
}
for (const dep of Object.keys(pkg.dependencies)) {
  if (!packages.has(dep)) problems.push(`dépendance de production absente : ${dep}`);
}

// ---------------------------------------------------------------- resources/, installeur, latest.yml

const extra = readdirSync(RESOURCES).filter(
  (f) => !['app.asar', 'app.asar.unpacked', 'app-update.yml', 'elevate.exe'].includes(f),
);
if (extra.length) problems.push(`fichiers inattendus dans resources/ : ${extra.join(', ')}`);
const unpacked = readdirSync(path.join(RESOURCES, 'app.asar.unpacked'), { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => `/${path.relative(path.join(RESOURCES, 'app.asar.unpacked'), path.join(d.parentPath, d.name)).replace(/\\/g, '/')}`);
if (unpacked.join() !== APP_ICON) problems.push(`app.asar.unpacked inattendu : ${unpacked.join(', ') || '(vide)'}`);

const installer = `Wakfu-Professions-Overlay-Setup-${pkg.version}.exe`;
let installerBytes = 0;
try {
  installerBytes = statSync(path.join(RELEASE, installer)).size;
  if (installerBytes > MAX_INSTALLER_BYTES) problems.push(`installeur de ${(installerBytes / 2 ** 20).toFixed(1)} Mo (> 120 Mo)`);
} catch {
  problems.push(`installeur absent : release/${installer}`);
}
// Avec les Releases GitHub, electron-builder écrit toujours latest.yml, y compris pour une bêta : l'application
// cherche d'abord beta.yml puis se rabat sur latest.yml ; c'est le statut « pré-release » qui distingue les bêtas.
const channelFile = 'latest.yml';
try {
  const info = readFileSync(path.join(RELEASE, channelFile), 'utf8');
  if (!info.includes(`version: ${pkg.version}`) || !info.includes(`path: ${installer}`)) {
    problems.push(`${channelFile} ne désigne pas cet installeur`);
  }
} catch {
  problems.push(`${channelFile} absent`);
}

console.log(
  `app.asar : ${files.filter((f) => f.startsWith('/out/')).length} fichiers dans out/, ` +
    `dépendances ${[...packages].sort().join(', ')}`,
);
console.log(`installeur : release/${installer}, ${(installerBytes / 2 ** 20).toFixed(1)} Mo`);
if (problems.length) {
  console.error(`\n${problems.length} problème(s) :\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('paquet conforme : aucune donnée ni icône Ankama embarquée');
