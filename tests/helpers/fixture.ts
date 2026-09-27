import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIndexFile, type GameIndexFile } from '../../src/core/data/indexFile';
import { loadIndex, type GameIndex } from '../../src/core/data/loadIndex';
import type { Locale } from '../../src/core/i18n';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const FIXTURE_PATH = path.join(FIXTURES, 'index-subset.json');
export const FIXTURE_V2_PATH = path.join(FIXTURES, 'index-v2-modified.json');
export const STATE_V1_PATH = path.join(FIXTURES, 'state-v1.json');
export const STATE_V2_PATH = path.join(FIXTURES, 'state-v2.json');
export const STATE_V3_PATH = path.join(FIXTURES, 'state-v3.json');
export const STATE_V4_PATH = path.join(FIXTURES, 'state-v4.json');
/** Fausse version suivante du jeu, dans index-v2-modified.json. */
export const V2 = '1.93.2.0';

function load(file: string, locale: Locale): { file: GameIndexFile; index: GameIndex } {
  const parsed = parseIndexFile(JSON.parse(readFileSync(file, 'utf8')));
  return { file: parsed, index: loadIndex(parsed, locale) };
}

/** Extrait de l'index réel (scripts/extract-fixture.ts) : objets des cas de test et noms des tests de recherche. */
export function loadFixture(locale: Locale = 'fr'): { file: GameIndexFile; index: GameIndex } {
  return load(FIXTURE_PATH, locale);
}

/** Même extrait dans une fausse version suivante : Krak-Ertz 7 → 8 (R6446), R7362 et Baguette Deuh Pain retirées. */
export function loadFixtureV2(): { file: GameIndexFile; index: GameIndex } {
  return load(FIXTURE_V2_PATH, 'fr');
}

/** state.json tel que l'écrit le format 1 (tests de migration). */
export function readStateV1(): unknown {
  return JSON.parse(readFileSync(STATE_V1_PATH, 'utf8'));
}

/** state.json au format 2 : celui de state-v1.json, avec la langue choisie. */
export function readStateV2(): unknown {
  return JSON.parse(readFileSync(STATE_V2_PATH, 'utf8'));
}

/** state.json au format 3 : celui de state-v2.json, affiché avec Wakfu et lancé avec Windows. */
export function readStateV3(): unknown {
  return JSON.parse(readFileSync(STATE_V3_PATH, 'utf8'));
}

/** state.json au format courant (4) : celui de state-v3.json, avec des niveaux de métier (Tailleur 125, Ébéniste 60). */
export function readStateV4(): unknown {
  return JSON.parse(readFileSync(STATE_V4_PATH, 'utf8'));
}
