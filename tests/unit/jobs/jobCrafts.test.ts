import { describe, expect, it } from 'vitest';
import { INDEX_SCHEMA, type GameIndexFile, type Names } from '../../../src/core/data/indexFile';
import { loadIndex, type GameIndex } from '../../../src/core/data/loadIndex';
import { jobCrafts, jobsByName, MAX_JOB_LEVEL, withJobLevel, type JobCraftList } from '../../../src/core/jobs/jobCrafts';
import { loadFixture } from '../../helpers/fixture';
import { IDS } from '../../helpers/needsCases';

const { index } = loadFixture();
const TAILLEUR = 79;
const EBENISTE = 81;
const ARMURIER = 77;
const BOULANGER = 40;

/** « niveau : nom #id » de chaque ligne, dans l'ordre d'affichage. */
const rows = (list: JobCraftList) => list.groups.flatMap((g) => g.crafts.map((c) => `${g.level} : ${c.item.name} #${c.item.id}`));

describe('jobCrafts', () => {
  it('un métier : ses crafts par niveau de métier croissant', () => {
    const list = jobCrafts(index, TAILLEUR);
    expect(list.groups.map((g) => g.level)).toEqual([70, 78, 80]);
    expect(rows(list)).toEqual([
      `70 : Fibre Durable #${IDS.FIBRE}`,
      `78 : Coiffe Lardante #${IDS.COIFFE_M}`,
      `80 : Coiffe Lardante #${IDS.COIFFE_L}`,
    ]);
    expect(list.groups[2]!.crafts[0]!.recipe.isUpgrade).toBe(true);
    expect({ shown: list.shown, total: list.total }).toEqual({ shown: 3, total: 3 });
  });

  it('un objet à plusieurs variantes de recette ne donne qu\'une ligne, au niveau de sa recette par défaut', () => {
    expect(index.recipesByItem.get(IDS.ORBE)).toHaveLength(7);
    const list = jobCrafts(index, EBENISTE);
    expect(rows(list)).toEqual([`75 : Orbe Durable #${IDS.ORBE}`, '130 : Wé #27193']);
    expect(list.groups[0]!.crafts[0]!.recipe.id).toBe(index.recipesByItem.get(IDS.ORBE)![0]!.id);
  });

  it('niveau du joueur : seulement les recettes de ce niveau ou moins', () => {
    const list = jobCrafts(index, TAILLEUR, { maxLevel: 78 });
    expect(rows(list)).toEqual([`70 : Fibre Durable #${IDS.FIBRE}`, `78 : Coiffe Lardante #${IDS.COIFFE_M}`]);
    expect({ shown: list.shown, total: list.total }).toEqual({ shown: 2, total: 3 });
    expect(rows(jobCrafts(index, BOULANGER, { maxLevel: 0 }))).toEqual([`0 : Pain de Farle #${IDS.PAIN_FARLE}`]);
    expect(jobCrafts(index, TAILLEUR, { maxLevel: 69 }).groups).toEqual([]);
  });

  it('sans les améliorations', () => {
    const list = jobCrafts(index, ARMURIER, { upgrades: false });
    expect(rows(list)).toEqual(['77 : Epaulettes Lardantes #16971']);
    expect(list.total).toBe(3);
  });

  it('filtre par nom, sans tenir compte des accents ni des majuscules', () => {
    expect(rows(jobCrafts(index, TAILLEUR, { query: '  COIFFE ' }))).toEqual([
      `78 : Coiffe Lardante #${IDS.COIFFE_M}`,
      `80 : Coiffe Lardante #${IDS.COIFFE_L}`,
    ]);
    expect(rows(jobCrafts(index, EBENISTE, { query: 'we' }))).toEqual(['130 : Wé #27193']);
    expect(rows(jobCrafts(index, TAILLEUR, { query: 'coiffe', maxLevel: 79, upgrades: true }))).toEqual([
      `78 : Coiffe Lardante #${IDS.COIFFE_M}`,
    ]);
    expect(jobCrafts(index, TAILLEUR, { query: 'orbe' }).shown).toBe(0);
  });

  it('dans la langue de l\'index', () => {
    const en = loadFixture('en').index;
    expect(rows(jobCrafts(en, TAILLEUR, { query: 'hat' }))).toEqual([
      `78 : Larduous Hat #${IDS.COIFFE_M}`,
      `80 : Larduous Hat #${IDS.COIFFE_L}`,
    ]);
  });

  it('métier inconnu : aucun craft', () => {
    expect(jobCrafts(index, 12345)).toEqual({ groups: [], shown: 0, total: 0 });
  });

  it('au même niveau : par nom, puis par rareté', () => {
    const synthetic = syntheticIndex([
      [1, 'Zèbre', 1],
      [2, 'Âne', 2],
      [3, 'Âne', 1],
      [4, 'Bœuf', 1],
    ]);
    expect(rows(jobCrafts(synthetic, 1))).toEqual(['10 : Âne #3', '10 : Âne #2', '10 : Bœuf #4', '10 : Zèbre #1']);
  });
});

describe('jobsByName', () => {
  it('dans l\'ordre alphabétique de la langue de l\'index, accents compris', () => {
    const names = jobsByName(index).map((j) => j.name);
    expect(names[0]).toBe('Armurier');
    expect(names.indexOf('Ébéniste')).toBe(names.indexOf('Boulanger') + 1);
    expect(names).toHaveLength(index.jobs.size);
    const en = jobsByName(loadFixture('en').index).map((j) => j.name);
    expect(en).toEqual([...en].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('withJobLevel', () => {
  it('enregistre, arrondit et borne le niveau ; champ vidé : plus de filtre', () => {
    const levels = { [TAILLEUR]: 125 };
    expect(withJobLevel(levels, EBENISTE, 60.7)).toEqual({ [TAILLEUR]: 125, [EBENISTE]: 60 });
    expect(withJobLevel(levels, TAILLEUR, -3)).toEqual({ [TAILLEUR]: 0 });
    expect(withJobLevel(levels, TAILLEUR, 5000)).toEqual({ [TAILLEUR]: MAX_JOB_LEVEL });
    expect(withJobLevel(levels, TAILLEUR, null)).toEqual({});
    expect(withJobLevel(levels, TAILLEUR, Number.NaN)).toEqual({});
    expect(levels).toEqual({ [TAILLEUR]: 125 });
  });
});

/** Un métier (1), une recette de niveau 10 par objet : [id, nom, rareté]. */
function syntheticIndex(items: [number, string, number][]): GameIndex {
  const names = (name: string): Names => [name, name, name, name];
  const file: GameIndexFile = {
    indexSchema: INDEX_SCHEMA,
    gameVersion: '1.0',
    builtAt: '2026-09-27T00:00:00.000Z',
    jobs: [[1, names('Métier')]],
    types: [],
    items: items.map(([id, name, rarity]) => [id, names(name), 1, rarity, 1, id]),
    recipes: items.map(([id]) => [100 + id, 1, 10, 0, id, 1, [99, 1]]),
    harvest: [],
  };
  return loadIndex(file, 'fr');
}
