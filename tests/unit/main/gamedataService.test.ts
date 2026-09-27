import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INDEX_SCHEMA } from '../../../src/core/data/indexFile';
import {
  downloadRawFiles,
  GamedataService,
  RAW_FILE_BYTES,
  type DataStatus,
  type GamedataServiceOptions,
} from '../../../src/main/data/gamedataService';
import { CDN, mockCdn, SMALL_COUNTS, syntheticRaw } from '../../helpers/synthetic';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'gamedata-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const V1 = '1.0.0.1';
const V2 = '1.0.0.2';
const dataPath = (...parts: string[]) => path.join(dir, 'data', ...parts);

function service(cdn: ReturnType<typeof mockCdn>, extra: Partial<GamedataServiceOptions> = {}) {
  return new GamedataService({ dir, fetch: cdn.fetch, cdn: CDN, minCounts: SMALL_COUNTS, ...extra });
}

/** Premier lancement en ligne, version V1 installée. */
async function installV1(cdn = mockCdn({ [V1]: syntheticRaw() }, V1)) {
  const svc = service(cdn);
  await svc.loadCache();
  await svc.check();
  return { svc, cdn };
}

describe('GamedataService', () => {
  it('premier lancement : télécharge les 9 fichiers, construit et écrit data/index.json', async () => {
    const cdn = mockCdn({ [V1]: syntheticRaw() }, V1);
    const svc = service(cdn);
    const statuses: DataStatus[] = [];
    const indexes: [string, string | null][] = [];
    svc.onStatus((s) => statuses.push(s));
    svc.onIndex((file, previous) => indexes.push([file.gameVersion, previous]));

    await svc.loadCache();
    expect(svc.indexFile).toBeNull();
    await svc.check();

    expect(svc.status).toMatchObject({ version: V1, offline: false, busy: null, error: null });
    expect(svc.indexFile?.items.map((i) => i[1][0])).toEqual(['Blé', 'Farine', 'Pain', "Seau d'eau", 'Plan du Pain']);
    expect(svc.indexFile?.items[0]?.[1]).toEqual(['Blé', 'Wheat', 'Trigo', 'Trigo']);
    expect(svc.indexFile?.harvest).toEqual([
      [4, 40, 3],
      [4, 64, 5],
    ]);
    expect(svc.indexFile?.plans).toEqual([[11, 6]]);
    expect(indexes).toEqual([[V1, null]]);
    expect(cdn.calls).toHaveLength(10); // config.json + 9 fichiers
    expect(JSON.parse(await readFile(dataPath('index.json'), 'utf8')).gameVersion).toBe(V1);
    expect(existsSync(dataPath('raw', V1, 'jobsItems.json'))).toBe(true);
    // Progression affichable pendant le téléchargement, puis construction.
    const busy = statuses.map((s) => s.busy).filter(Boolean);
    expect(busy[0]).toEqual({ step: 'download', version: V1, done: 0, total: 9, percent: 0 });
    expect(busy).toContainEqual({ step: 'download', version: V1, done: 9, total: 9, percent: 100 });
    expect(busy.at(-1)).toEqual({ step: 'build', version: V1 });
  });

  it('hors ligne sans cache : erreur signalée, aucune donnée', async () => {
    const cdn = mockCdn({}, V1);
    cdn.state.online = false;
    const svc = service(cdn);
    await svc.loadCache();
    await svc.check();
    expect(svc.indexFile).toBeNull();
    expect(svc.status).toMatchObject({ version: null, offline: true });
    expect(svc.status.error).toEqual({ code: 'offline-no-data', version: null, kept: null });
  });

  it('démarrage hors ligne avec cache : fonctionnement normal, badge hors ligne', async () => {
    await installV1();
    const cdn = mockCdn({}, V1);
    cdn.state.online = false;
    const svc = service(cdn);
    await svc.loadCache();
    expect(svc.indexFile?.gameVersion).toBe(V1);
    await svc.check();
    expect(svc.status).toMatchObject({ version: V1, offline: true, error: null });
    expect(cdn.calls).toEqual(['config.json']);
  });

  it('même version publiée : rien n\'est retéléchargé', async () => {
    const { svc, cdn } = await installV1();
    cdn.calls.length = 0;
    await svc.check();
    expect(cdn.calls).toEqual(['config.json']);
    expect(svc.status.error).toBeNull();
  });

  it('nouvelle version : reconstruction, index.prev.json gardé, anciens fichiers bruts supprimés', async () => {
    const cdn = mockCdn({ [V1]: syntheticRaw(), [V2]: syntheticRaw({ flourQty: 3 }) }, V1);
    const { svc } = await installV1(cdn);
    const changes: [string, string | null][] = [];
    svc.onIndex((file, previous) => changes.push([file.gameVersion, previous]));

    cdn.state.version = V2;
    await svc.check();

    expect(changes).toEqual([[V2, V1]]);
    expect(svc.status).toMatchObject({ version: V2, error: null });
    expect(svc.indexFile?.recipes.find((r) => r[0] === 10)?.[6]).toEqual([1, 3]);
    expect(JSON.parse(await readFile(dataPath('index.prev.json'), 'utf8')).gameVersion).toBe(V1);
    expect(existsSync(dataPath('raw', V1))).toBe(false);
    expect(existsSync(dataPath('raw', V2))).toBe(true);
  });

  it('format inattendu dans la nouvelle version : index précédent conservé et signalé', async () => {
    const broken = syntheticRaw();
    broken.recipes = [{ id: 10, categoryId: 40, level: 5, isUpgrade: 'non', upgradeItemId: 0 }];
    const cdn = mockCdn({ [V1]: syntheticRaw(), [V2]: broken }, V1);
    const { svc } = await installV1(cdn);

    cdn.state.version = V2;
    await svc.check();

    expect(svc.indexFile?.gameVersion).toBe(V1);
    expect(svc.status).toMatchObject({ version: V1, busy: null });
    expect(svc.status.error).toEqual({ code: 'format', version: V2, kept: V1 });
    // Les fichiers inutilisables sont supprimés pour être retéléchargés à la prochaine vérification.
    expect(existsSync(dataPath('raw', V2))).toBe(false);
    expect(JSON.parse(await readFile(dataPath('index.json'), 'utf8')).gameVersion).toBe(V1);
  });

  it('données trop maigres (seuils plancher) : traitées comme un format inattendu', async () => {
    const cdn = mockCdn({ [V1]: syntheticRaw() }, V1);
    const svc = service(cdn, { minCounts: { recipes: 100, items: 1, jobs: 1 } });
    await svc.check();
    expect(svc.indexFile).toBeNull();
    expect(svc.status.error).toEqual({ code: 'format', version: V1, kept: null });
  });

  it('config.json au format inattendu', async () => {
    const { svc, cdn } = await installV1();
    cdn.state.configBody = { build: 'x' };
    await svc.check();
    expect(svc.status.error).toEqual({ code: 'format', version: null, kept: V1 });
    expect(svc.indexFile?.gameVersion).toBe(V1);
  });

  it('téléchargement interrompu : reprise sans retélécharger les fichiers complets', async () => {
    const cdn = mockCdn({ [V1]: syntheticRaw() }, V1);
    cdn.state.failOn = `${V1}/recipeCategories.json`;
    const svc = service(cdn);
    await svc.check();
    expect(svc.indexFile).toBeNull();
    expect(svc.status.error).toEqual({ code: 'network', version: V1, kept: null });

    cdn.state.failOn = undefined;
    cdn.calls.length = 0;
    await svc.check();
    expect(svc.status).toMatchObject({ version: V1, error: null });
    expect(cdn.calls).toEqual([
      'config.json',
      `${V1}/recipeCategories.json`,
      `${V1}/jobsItems.json`,
      `${V1}/itemTypes.json`,
      `${V1}/collectibleResources.json`,
      `${V1}/harvestLoots.json`,
      `${V1}/blueprints.json`,
    ]);
  });

  it("données d'une version précédente de l'application (sans fichiers de récolte) : hors ligne sans provenance, puis complétées en ligne", async () => {
    await installV1();
    for (const name of ['collectibleResources', 'harvestLoots']) await rm(dataPath('raw', V1, `${name}.json`));
    const stale = JSON.parse(await readFile(dataPath('index.json'), 'utf8'));
    await writeFile(dataPath('index.json'), JSON.stringify({ ...stale, indexSchema: INDEX_SCHEMA - 1 }));

    const cdn = mockCdn({ [V1]: syntheticRaw() }, V1);
    cdn.state.online = false;
    const logs: string[] = [];
    const svc = service(cdn, { log: (m) => logs.push(m) });
    const changes: [string, string | null][] = [];
    svc.onIndex((file, previous) => changes.push([file.gameVersion, previous]));
    await svc.loadCache();
    expect(svc.indexFile).toMatchObject({ indexSchema: INDEX_SCHEMA, gameVersion: V1, harvest: [] });
    expect(logs).toContainEqual(expect.stringContaining('fichiers de récolte absents'));

    cdn.state.online = true;
    await svc.check();
    expect(cdn.calls).toEqual(['config.json', `${V1}/collectibleResources.json`, `${V1}/harvestLoots.json`]);
    expect(svc.indexFile?.harvest).toHaveLength(2);
    expect(svc.status).toMatchObject({ version: V1, busy: null, error: null });
    expect(changes).toEqual([
      [V1, null],
      [V1, V1],
    ]);

    // Ensuite, plus rien à télécharger.
    cdn.calls.length = 0;
    await svc.check();
    expect(cdn.calls).toEqual(['config.json']);
  });

  it('fichiers de récolte au format inattendu : index construit sans provenance, sans erreur', async () => {
    const raw = syntheticRaw();
    raw['collectibleResources'] = [{ skillId: 'Mineur' }];
    const logs: string[] = [];
    const svc = service(mockCdn({ [V1]: raw }, V1), { log: (m) => logs.push(m) });
    await svc.check();
    expect(svc.status).toMatchObject({ version: V1, error: null });
    expect(svc.indexFile?.harvest).toEqual([]);
    expect(logs).toContainEqual(expect.stringContaining('fichiers de récolte ignorés (collectibleResources.json : format inattendu'));
  });

  it("données d'une version précédente de l'application (sans le fichier des plans) : plans ajoutés en ligne", async () => {
    await installV1();
    await rm(dataPath('raw', V1, 'blueprints.json'));
    const stale = JSON.parse(await readFile(dataPath('index.json'), 'utf8'));
    await writeFile(dataPath('index.json'), JSON.stringify({ ...stale, indexSchema: INDEX_SCHEMA - 1 }));

    const cdn = mockCdn({ [V1]: syntheticRaw() }, V1);
    cdn.state.online = false;
    const logs: string[] = [];
    const svc = service(cdn, { log: (m) => logs.push(m) });
    await svc.loadCache();
    expect(svc.indexFile).toMatchObject({ indexSchema: INDEX_SCHEMA, plans: [] });
    expect(logs).toContainEqual(expect.stringContaining('fichier des plans absent'));

    cdn.state.online = true;
    await svc.check();
    expect(cdn.calls).toEqual(['config.json', `${V1}/blueprints.json`]);
    expect(svc.indexFile?.plans).toEqual([[11, 6]]);
    expect(svc.status).toMatchObject({ version: V1, busy: null, error: null });
  });

  it('fichier des plans au format inattendu : index construit sans plans, sans erreur', async () => {
    const raw = syntheticRaw();
    raw['blueprints'] = { plans: 'aucun' };
    const logs: string[] = [];
    const svc = service(mockCdn({ [V1]: raw }, V1), { log: (m) => logs.push(m) });
    await svc.check();
    expect(svc.status).toMatchObject({ version: V1, error: null });
    expect(svc.indexFile?.plans).toEqual([]);
    expect(svc.indexFile?.harvest).toHaveLength(2);
    expect(logs).toContainEqual(expect.stringContaining('fichier des plans ignoré (blueprints.json : format inattendu'));
  });

  it("nouvelle version de l'application (format d'index changé) : reconstruction sans réseau", async () => {
    await installV1();
    const stale = JSON.parse(await readFile(dataPath('index.json'), 'utf8'));
    await writeFile(dataPath('index.json'), JSON.stringify({ ...stale, indexSchema: INDEX_SCHEMA - 1, items: 'ancien format' }));

    const cdn = mockCdn({}, V1);
    cdn.state.online = false;
    const svc = service(cdn);
    await svc.loadCache();
    expect(cdn.calls).toEqual([]);
    expect(svc.indexFile).toMatchObject({ indexSchema: INDEX_SCHEMA, gameVersion: V1 });
    expect(JSON.parse(await readFile(dataPath('index.json'), 'utf8')).indexSchema).toBe(INDEX_SCHEMA);
    expect(existsSync(dataPath('index.prev.json'))).toBe(false);
  });

  it('index.json corrompu ou absent : reconstruction depuis les fichiers bruts les plus récents', async () => {
    await installV1();
    await writeFile(dataPath('index.json'), '{ tronqué');
    const svc = service(mockCdn({}, V1));
    await svc.loadCache();
    expect(svc.indexFile?.gameVersion).toBe(V1);

    await rm(dataPath('index.json'));
    const again = service(mockCdn({}, V1));
    await again.loadCache();
    expect(again.indexFile?.gameVersion).toBe(V1);
  });

  it('cache inutilisable et fichiers bruts absents : aucune donnée, sans planter', async () => {
    await installV1();
    await writeFile(dataPath('index.json'), JSON.stringify({ indexSchema: 0, gameVersion: '9.9.9.9' }));
    const svc = service(mockCdn({}, V1));
    await svc.loadCache();
    expect(svc.indexFile).toBeNull();
  });

  it('repli sur items.json quand jobsItems.json ne couvre pas tous les ids', async () => {
    const cdn = mockCdn({ [V1]: syntheticRaw({ withYeast: true }) }, V1);
    const logs: string[] = [];
    const svc = service(cdn, { log: (m) => logs.push(m) });
    await svc.check();
    expect(cdn.calls).toContain(`${V1}/items.json`);
    expect(svc.indexFile?.items.find((i) => i[0] === 5)?.[1][0]).toBe('Levure');
    expect(logs.some((l) => l.includes('téléchargement de items.json'))).toBe(true);

    // Reconstruction hors ligne : items.json déjà présent est réutilisé.
    const offline = mockCdn({}, V1);
    offline.state.online = false;
    await writeFile(dataPath('index.json'), '{}');
    const again = service(offline);
    await again.loadCache();
    expect(again.indexFile?.items.find((i) => i[0] === 5)?.[1][0]).toBe('Levure');
  });

  it('ids introuvables même dans items.json : index construit, ids signalés', async () => {
    const raw = syntheticRaw({ withYeast: true });
    raw.items = [];
    const logs: string[] = [];
    const svc = service(mockCdn({ [V1]: raw }, V1), { log: (m) => logs.push(m) });
    await svc.check();
    expect(svc.indexFile?.gameVersion).toBe(V1);
    expect(logs.some((l) => l.includes('1 id(s) non résolu(s)'))).toBe(true);
  });

  it('une seule vérification à la fois', async () => {
    const cdn = mockCdn({ [V1]: syntheticRaw() }, V1);
    const svc = service(cdn);
    const [a, b] = [svc.check(), svc.check()];
    expect(a).toBe(b);
    await a;
    expect(cdn.calls.filter((c) => c === 'config.json')).toHaveLength(1);
  });

  it('checkIfStale ne revérifie qu\'après 6 h', async () => {
    let now = 1_000_000;
    const cdn = mockCdn({ [V1]: syntheticRaw() }, V1);
    const svc = service(cdn, { now: () => now });
    await svc.checkIfStale();
    expect(svc.status.lastCheckAt).toBe(now);
    cdn.calls.length = 0;

    now += 5 * 3600 * 1000;
    await svc.checkIfStale();
    expect(cdn.calls).toEqual([]);

    now += 1 * 3600 * 1000;
    await svc.checkIfStale();
    expect(cdn.calls).toEqual(['config.json']);
  });

  it('progression du téléchargement au fil des octets reçus, sans taille annoncée par le CDN', async () => {
    // jobsItems.json arrive en 10 blocs (réponse compressée : pas de Content-Length), les autres d'un coup.
    const jobsBytes = RAW_FILE_BYTES['jobsItems']!;
    const block = new Uint8Array(Math.ceil(jobsBytes / 10));
    const fetch = async (url: string) => {
      if (!url.endsWith('/jobsItems.json')) return new Response('[]');
      let sent = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent++ < 10) controller.enqueue(block);
          else controller.close();
        },
      });
      return new Response(stream);
    };
    const names = ['recipes', 'jobsItems', 'itemTypes'];
    const progress: [number, number][] = [];
    await downloadRawFiles(dataPath('raw', V1), V1, names, {
      fetch,
      cdn: CDN,
      timeoutMs: 1000,
      onProgress: (done, total, fraction) => {
        expect(total).toBe(3);
        progress.push([done, fraction]);
      },
    });

    const total = names.reduce((a, n) => a + RAW_FILE_BYTES[n]!, 0);
    const afterRecipes = RAW_FILE_BYTES['recipes']! / total;
    const afterJobs = afterRecipes + jobsBytes / total;
    const fractions = progress.map(([, f]) => f);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    expect(progress.at(-1)).toEqual([3, 1]);
    // Pendant jobsItems.json : 10 étapes intermédiaires, sans jamais atteindre sa part avant la fin du fichier.
    const during = progress.filter(([done]) => done === 1).map(([, f]) => f);
    expect(during.length).toBe(11);
    expect(during.filter((f) => f > afterRecipes + 0.1 * (afterJobs - afterRecipes))).not.toHaveLength(0);
    expect(Math.max(...during)).toBeLessThan(afterJobs);
    expect(progress.find(([done]) => done === 2)?.[1]).toBeCloseTo(afterJobs, 12);
  });

  it('désabonnement des écouteurs', async () => {
    const svc = service(mockCdn({ [V1]: syntheticRaw() }, V1));
    let calls = 0;
    const off = svc.onStatus(() => calls++);
    const offIndex = svc.onIndex(() => calls++);
    off();
    offIndex();
    await svc.check();
    expect(calls).toBe(0);
  });
});
