// Extrait tests/fixtures/index-subset.json de l'index réel (version figée des tests) :
// - chaînes de craft complètes (toutes variantes, récursivement) des cas de test de référence (tests/helpers/needsCases.ts) ;
// - quelques objets gardés avec leurs recettes et leurs ingrédients directs seulement, pour les tests de recherche.
// En dérive tests/fixtures/index-v2-modified.json, une fausse version suivante du jeu pour les tests de rapprochement.
// Données © Ankama : extrait factuel limité (ids, noms, niveaux, quantités).
// Usage : npm run fixture
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GameIndexFile } from '../src/core/data/indexFile';
import { FIXTURE_PATH, FIXTURE_V2_PATH, V2 } from '../tests/helpers/fixture';
import { IDS } from '../tests/helpers/needsCases';
import { buildRealIndex } from '../tests/helpers/realData';

const { file, index } = await buildRealIndex();

const FULL_TREES = [IDS.COIFFE_L, IDS.BAGUETTE, IDS.PAIN_FARLE];
const NAME_ONLY_IDS = [IDS.PONCTUATION_1, IDS.PONCTUATION_2, 27193 /* Wé */];
const NAME_ONLY_NAMES = ["Bottes de N'Oeuf lieues", "Bottes de N'Oeuf Lieues", 'Bottes Lardantes', 'Epaulettes Lardantes'];

const items = new Set<number>();
const recipes = new Set<number>();
const expanded = new Set<number>();

const full = (id: number): void => {
  items.add(id);
  if (expanded.has(id)) return;
  expanded.add(id);
  for (const r of index.recipesByItem.get(id) ?? []) {
    recipes.add(r.id);
    for (const g of r.ings) full(g.itemId);
  }
};
const shallow = (id: number): void => {
  items.add(id);
  for (const r of index.recipesByItem.get(id) ?? []) {
    recipes.add(r.id);
    for (const g of r.ings) items.add(g.itemId);
  }
};

FULL_TREES.forEach(full);
const byName = [...index.items.values()].filter((i) => NAME_ONLY_NAMES.includes(i.name) && index.recipesByItem.has(i.id));
for (const id of [...NAME_ONLY_IDS, ...byName.map((i) => i.id)]) shallow(id);

const keptRecipes = file.recipes.filter((r) => recipes.has(r[0]));
const keptItems = file.items.filter((i) => items.has(i[0]));
const jobIds = new Set(keptRecipes.map((r) => r[1]));
const typeIds = new Set(keptItems.map((i) => i[4]));

const subset: GameIndexFile = {
  indexSchema: file.indexSchema,
  gameVersion: file.gameVersion,
  builtAt: 'fixture',
  jobs: file.jobs.filter((j) => jobIds.has(j[0])),
  types: file.types.filter((t) => typeIds.has(t[0])),
  items: keptItems,
  recipes: keptRecipes,
};

// Fausse version suivante : Krak-Ertz 7 → 8 dans la recette par défaut de l'Orbe Durable (R6446),
// variante R7362 de l'Orbe retirée, Baguette Deuh Pain retirée du jeu (objet et recette).
const krak = keptItems.find((i) => i[1] === 'Krak-Ertz')![0];
const v2: GameIndexFile = structuredClone({ ...subset, gameVersion: V2 });
const r6446 = v2.recipes.find((r) => r[0] === 6446)!;
r6446[6][r6446[6].indexOf(krak) + 1] = 8;
v2.recipes = v2.recipes.filter((r) => r[0] !== 7362 && r[4] !== IDS.BAGUETTE);
v2.items = v2.items.filter((i) => i[0] !== IDS.BAGUETTE);

const rows = (values: unknown[]) => values.map((v) => `    ${JSON.stringify(v)}`).join(',\n');
const render = (f: GameIndexFile, note: string) => `{
  "_note": ${JSON.stringify(note)},
  "indexSchema": ${f.indexSchema},
  "gameVersion": ${JSON.stringify(f.gameVersion)},
  "builtAt": ${JSON.stringify(f.builtAt)},
  "jobs": [
${rows(f.jobs)}
  ],
  "types": [
${rows(f.types)}
  ],
  "items": [
${rows(f.items)}
  ],
  "recipes": [
${rows(f.recipes)}
  ]
}
`;
const source = `Extrait de gamedata ${file.gameVersion} (données © Ankama), généré par scripts/extract-fixture.ts : ne pas modifier à la main.`;
await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
await writeFile(FIXTURE_PATH, render(subset, source), 'utf8');
await writeFile(
  FIXTURE_V2_PATH,
  render(v2, `${source} Fausse version ${V2} : Krak-Ertz 7 → 8 dans R6446, R7362 et Baguette Deuh Pain retirées.`),
  'utf8',
);
console.log(`${FIXTURE_PATH} : ${keptItems.length} objets, ${keptRecipes.length} recettes, ${jobIds.size} métiers, ${typeIds.size} types`);
console.log(`${FIXTURE_V2_PATH} : version ${V2}, ${v2.items.length} objets, ${v2.recipes.length} recettes`);
