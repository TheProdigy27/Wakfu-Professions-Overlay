import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildIndex } from '../../src/core/data/buildIndex';
import { parseIndexFile } from '../../src/core/data/indexFile';
import { loadIndex } from '../../src/core/data/loadIndex';
import { LOCALES, messages } from '../../src/core/i18n';
import { jobCrafts, jobsByName } from '../../src/core/jobs/jobCrafts';
import { readItemsFallback, readRawGamedata } from '../../src/main/data/gamedataService';
import { loadFixture } from '../helpers/fixture';
import { buildRealIndex, ensureRealRaw, REAL_DATA_VERSION, type RealIndex } from '../helpers/realData';

let real: RealIndex;
beforeAll(async () => {
  real = await buildRealIndex();
});

describe(`données réelles ${REAL_DATA_VERSION} : construction de l'index`, () => {
  it('les 9 fichiers bruts passent la validation zod ; 100 % des ids sont résolus', () => {
    expect(real.report).toEqual({
      recipes: 5428,
      excludedRecipes: 0,
      // 8 204 objets cités par une recette, 108 plans.
      items: 8312,
      missingItemIds: [],
      itemsFromFallback: 0,
      multiResultRecipes: 0,
      harvestedItems: 347,
      planRecipes: 221,
    });
    expect(real.file.jobs).toHaveLength(14);
    expect(real.index.recipesByItem.size).toBe(5159);
  });

  it('provenance : 339 ressources récoltées directement, 8 en butin de récolte, un seul métier chacune', () => {
    const name = (id: number) => real.index.items.get(id)?.name;
    const label = (id: number) => real.index.harvest.get(id)?.map((h) => `${real.index.jobs.get(h.jobId)} ${h.level}`);
    const copper = [...real.index.items.values()].find((i) => i.name === 'Minerai de Cuivre')!;
    expect(label(copper.id)).toEqual(['Mineur 15']);
    // Seulement en butin : pierres précieuses (99 %) du Mineur, Cookillage (3 %) du Pêcheur.
    const agate = [...real.index.items.values()].find((i) => i.name === "Pierre d'Agate")!;
    expect(label(agate.id)).toEqual(['Mineur 30']);
    // Les 5 métiers de récolte présents dans collectibleResources.json (pas le Trappeur).
    expect(new Set(real.file.harvest.map((h) => h[1]))).toEqual(new Set([64, 71, 72, 73, 75]));
    expect([...real.index.harvest.values()].filter((list) => list.length > 1).map((list) => list.length)).toEqual([]);
    // Aucune ressource récoltée ne se crafte.
    expect([...real.index.harvest.keys()].filter((id) => real.index.recipesByItem.has(id)).map(name)).toEqual([]);
  });

  it('plans : 221 recettes à apprendre (4 recettes citées absentes du jeu), sans autre recette pour le même objet', () => {
    const plans = new Set(real.file.plans.map((p) => p[1]));
    expect(plans.size).toBe(108);
    // Tous des objets « Recette », nommés dans l'index.
    const types = new Set([...plans].map((id) => real.index.types.get(real.index.items.get(id)!.typeId)));
    expect(types).toEqual(new Set(['Recette']));
    // Un objet qui demande un plan n'a pas d'autre recette : l'affichage « Nécessite : … » est sans ambiguïté.
    const withPlan = real.file.plans.map(([recipeId]) => real.index.recipes.get(recipeId)!);
    const mixed = withPlan.filter((r) => real.index.recipesByItem.get(r.out)!.some((o) => o.plan === undefined));
    expect(mixed).toEqual([]);
    const kokordon = [...real.index.items.values()].filter((i) => i.name === 'Kokordon');
    expect(kokordon.map((i) => real.index.items.get(real.index.recipesByItem.get(i.id)![0]!.plan!)?.name)).toEqual([
      'Plan "Kokordon"',
      'Plan "Kokordon"',
      'Plan "Kokordon"',
    ]);
  });

  it('crafts par métier : chaque objet craftable apparaît dans un seul métier ; liste calculée en moins de 20 ms', () => {
    const counts = new Map<number, number>();
    for (const { id } of jobsByName(real.index)) {
      for (const group of jobCrafts(real.index, id).groups) {
        for (const { item } of group.crafts) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(real.index.recipesByItem.size);
    expect([...counts.values()].filter((n) => n > 1)).toEqual([]);
    const t0 = performance.now();
    const armurier = jobCrafts(real.index, 77, { query: 'e' });
    expect(performance.now() - t0).toBeLessThan(20);
    expect(armurier.total).toBe(960);
  });

  it('toutes les raretés présentes ont un nom, dans chaque langue', () => {
    const rarities = new Set(real.file.items.map((i) => i[3]));
    for (const locale of LOCALES) {
      expect([...rarities].filter((r) => !messages(locale).rarities[r])).toEqual([]);
    }
  });

  it('noms dans les quatre langues, sans gabarit de pluriel ni nom vide', () => {
    const names = [...real.file.items, ...real.file.jobs, ...real.file.types].flatMap((row) => row[1]);
    expect(names.filter((n) => !n.trim() || n.includes('{['))).toEqual([]);
    // Presque tous les objets ont un nom anglais distinct du français (quelques noms propres sont identiques).
    const translated = real.file.items.filter((i) => i[1][1] !== i[1][0]).length;
    expect(translated / real.file.items.length).toBeGreaterThan(0.95);
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
    loadIndex(file, 'fr');
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
    const harvest = new Set(real.file.harvest.map((h) => JSON.stringify(h)));
    for (const h of file.harvest) expect(harvest.has(JSON.stringify(h))).toBe(true);
    expect(file.harvest.length).toBe(real.file.harvest.filter((h) => items.has(h[0]) && file.items.some((i) => i[0] === h[0])).length);
    const plans = new Map(real.file.plans);
    for (const [recipeId, plan] of file.plans) expect(plans.get(recipeId)).toBe(plan);
    expect(file.plans.length).toBe(real.file.plans.filter((p) => recipes.has(p[0]) && file.recipes.some((r) => r[0] === p[0])).length);
    const jobs = new Map(real.file.jobs);
    for (const [id, names] of file.jobs) expect(jobs.get(id)).toEqual(names);
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
