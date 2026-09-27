import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIndexFile, type GameIndexFile } from '../../src/core/data/indexFile';
import { loadIndex, type GameIndex } from '../../src/core/data/loadIndex';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const FIXTURE_PATH = path.join(FIXTURES, 'index-subset.json');
export const FIXTURE_V2_PATH = path.join(FIXTURES, 'index-v2-modified.json');
export const STATE_V1_PATH = path.join(FIXTURES, 'state-v1.json');
/** Fausse version suivante du jeu, dans index-v2-modified.json. */
export const V2 = '1.93.2.0';

function load(file: string): { file: GameIndexFile; index: GameIndex } {
  const parsed = parseIndexFile(JSON.parse(readFileSync(file, 'utf8')));
  return { file: parsed, index: loadIndex(parsed) };
}

/** Extrait de l'index réel (scripts/extract-fixture.ts) : objets des cas de test et noms des tests de recherche. */
export function loadFixture(): { file: GameIndexFile; index: GameIndex } {
  return load(FIXTURE_PATH);
}

/** Même extrait dans une fausse version suivante : Krak-Ertz 7 → 8 (R6446), R7362 et Baguette Deuh Pain retirées. */
export function loadFixtureV2(): { file: GameIndexFile; index: GameIndex } {
  return load(FIXTURE_V2_PATH);
}

/** state.json tel que l'écrit le format 1 (tests de migration). */
export function readStateV1(): unknown {
  return JSON.parse(readFileSync(STATE_V1_PATH, 'utf8'));
}
