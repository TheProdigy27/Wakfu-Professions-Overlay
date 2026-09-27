import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildIndex } from '../../src/core/data/buildIndex';
import { parseIndexFile } from '../../src/core/data/indexFile';
import { loadIndex } from '../../src/core/data/loadIndex';
import { RARITY_NAMES } from '../../src/core/data/rarity';
import { readItemsFallback, readRawGamedata } from '../../src/main/data/gamedataService';
import { loadFixture } from '../helpers/fixture';
import { buildRealIndex, ensureRealRaw, REAL_DATA_VERSION, type RealIndex } from '../helpers/realData';

let real: RealIndex;
beforeAll(async () => {
  real = await buildRealIndex();
});

describe(`données réelles ${REAL_DATA_VERSION} : construction de l'index`, () => {
  it('les 6 fichiers bruts passent la validation zod ; 100 % des ids sont résolus', () => {
    expect(real.report).toEqual({
      recipes: 5428,
      excludedRecipes: 0,
      items: 8204,
      missingItemIds: [],
      itemsFromFallback: 0,
      multiResultRecipes: 0,
    });
    expect(real.file.jobs).toHaveLength(14);
    expect(real.index.recipesByItem.size).toBe(5159);
  });

  it('toutes les raretés présentes ont un nom', () => {
    const rarities = new Set(real.file.items.map((i) => i[3]));
    expect([...rarities].filter((r) => !(r in RARITY_NAMES))).toEqual([]);
  });

  it('index ≤ 2 Mo, construit en ≤ 3 s (lecture et validation comprises)', () => {
    const bytes = Buffer.byteLength(JSON.stringify(real.file));
    console.log(
      `index ${(bytes / 1e6).toFixed(2)} Mo ; lecture + validation ${real.readMs.toFixed(0)} ms, construction ${real.buildMs.toFixed(0)} ms`,
    );
    expect(bytes).toBeLessThanOrEqual(2e6);
    expect(real.readMs + real.buildMs).toBeLessThanOrEqual(3000);
  });

  it('chargement au démarrage (lecture JSON + validation + Maps) : mesure', () => {
    const text = JSON.stringify(real.file);
    const t0 = performance.now();
    const json = JSON.parse(text);
    const t1 = performance.now();
    const file = parseIndexFile(json);
    const t2 = performance.now();
    loadIndex(file);
    const t3 = performance.now();
    console.log(`JSON.parse ${(t1 - t0).toFixed(0)} ms, validation ${(t2 - t1).toFixed(0)} ms, Maps ${(t3 - t2).toFixed(0)} ms`);
    expect(t3 - t2).toBeLessThan(50);
  });

  it('la fixture est un extrait exact de l\'index réel', () => {
    const { file } = loadFixture();
    const byId = <T extends [number, ...unknown[]]>(rows: T[]) => new Map(rows.map((r) => [r[0], r]));
    const items = byId(real.file.items);
    const recipes = byId(real.file.recipes);
    for (const i of file.items) expect(items.get(i[0])).toEqual(i);
    for (const r of file.recipes) expect(recipes.get(r[0])).toEqual(r);
    const jobs = new Map(real.file.jobs);
    for (const [id, name] of file.jobs) expect(jobs.get(id)).toBe(name);
  });
});

describe(`données réelles ${REAL_DATA_VERSION} : repli items.json`, () => {
  it('items.json passe la validation et concorde avec jobsItems.json', async () => {
    const dir = await ensureRealRaw(['items']);
    const items = await readItemsFallback(dir);
    const raw = await readRawGamedata(dir);
    const jobsById = new Map(raw.jobsItems.map((x) => [x.definition.id, x]));
    let common = 0;
    for (const x of items) {
      const j = jobsById.get(x.definition.item.id);
      if (!j) continue;
      common++;
      expect([x.title.fr, x.definition.item.level, x.definition.item.baseParameters.rarity]).toEqual([
        j.title.fr,
        j.definition.level,
        j.definition.rarity,
      ]);
    }
    // Sans jobsItems.json, items.json seul résout une partie des ids : le repli complète, il ne remplace pas.
    const alone = buildIndex(REAL_DATA_VERSION, { ...raw, jobsItems: [] }, { itemsFallback: items, minCounts: { recipes: 1, items: 1, jobs: 1 } });
    console.log(
      `items.json : ${items.length} objets, ${common} en commun avec jobsItems.json ; seul, il résout ${alone.report.itemsFromFallback} ids sur ${alone.report.itemsFromFallback + alone.report.missingItemIds.length}`,
    );
    expect(common).toBeGreaterThan(6000);
    const size = (await readFile(path.join(dir, 'items.json'))).length;
    expect(size).toBeGreaterThan(10e6); // fichier complet, pas tronqué
  });
});
