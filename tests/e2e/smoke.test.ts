// Test de bout en bout : l'application construite démarre hors réseau (WPO_OFFLINE) sur l'index
// de fixture, puis parcours complet : recherche, T1a, case « je l'ai » partagée entre les vues, variante, ordre de
// craft, mode compact, raccourci ; la liste est restaurée au redémarrage ; l'interface passe en anglais ; enfin les
// crafts par métier.
// Cible : out/ (npm run build), ou l'exécutable empaqueté si WPO_E2E_EXE le désigne (release/win-unpacked/…).
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultState } from '../../src/core/state/schema';
import { FIXTURE_PATH } from '../helpers/fixture';

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXE = process.env['WPO_E2E_EXE'];

let userData: string;
let app: ElectronApplication | null = null;
let page: Page;
const consoleErrors: string[] = [];

async function launch(): Promise<void> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  // Hérités de VS Code ou du serveur de développement : Electron démarrerait comme Node, ou sur le mauvais panneau.
  delete env['ELECTRON_RUN_AS_NODE'];
  delete env['ELECTRON_RENDERER_URL'];
  env['WPO_OFFLINE'] = '1';
  const executablePath = EXE ? path.resolve(ROOT, EXE) : (createRequire(import.meta.url)('electron') as string);
  app = await electron.launch({
    executablePath,
    args: [...(EXE ? [] : [ROOT]), `--user-data-dir=${userData}`],
    env,
    timeout: 60_000,
  });
  page = await app.firstWindow();
  page.on('console', (m) => {
    // Hors réseau, les icônes wicon:// répondent 503 et sont remplacées : attendu.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  await page.waitForSelector('input[type=search]:not([disabled])', { timeout: 60_000 });
}

async function close(): Promise<void> {
  await app?.close();
  app = null;
}

const texts = (selector: string) => page.locator(selector).allInnerTexts();

/** Nom et quantité manquante de chaque ligne de la liste de courses. */
const shopping = () =>
  page.$$eval('.shop-table tbody tr', (rows) =>
    rows.map((r) => `${r.querySelector('.item-name')?.textContent}=${r.querySelector('.missing')?.textContent}`),
  );

/** Case « je l'ai » de la première ligne portant exactement ce nom, dans la vue affichée. */
async function toggleHave(name: string): Promise<void> {
  const row = page.locator('.row, .shop-table tbody tr').filter({ has: page.locator('.item-name', { hasText: name }) });
  await row.first().locator('input[type=checkbox]').click();
}

beforeAll(async () => {
  userData = await mkdtemp(path.join(tmpdir(), 'wpo-e2e-'));
  // Données du jeu déjà en cache, comme après un premier lancement : l'extrait de fixture tient lieu d'index.
  await mkdir(path.join(userData, 'data'));
  await copyFile(FIXTURE_PATH, path.join(userData, 'data', 'index.json'));
  // Français imposé : sinon, la langue de l'interface serait celle de Windows.
  const state = defaultState();
  await writeFile(path.join(userData, 'state.json'), JSON.stringify({ ...state, settings: { ...state.settings, language: 'fr' } }));
  await launch();
});

afterAll(async () => {
  await close();
  await rm(userData, { recursive: true, force: true });
});

describe('application construite, hors réseau', () => {
  it('démarre sur les données en cache et affiche l\'accueil', async () => {
    const status = await page.locator('.status').innerText();
    expect(status).toContain('Données 1.93.1.62');
    expect(status).toContain('hors ligne');
    await expect.poll(() => page.locator('.onboarding').count()).toBe(1);
    await page.getByRole('button', { name: 'Compris' }).click();
    expect(await page.locator('.onboarding').count()).toBe(0);
  });

  it('recherche : les deux raretés de Coiffe Lardante, en couleur, avec leur niveau', async () => {
    await page.locator('input[type=search]').fill('coiffe lard');
    await page.waitForSelector('.search-results li[role=option]');
    const results = await texts('.search-results li[role=option]');
    expect(results.slice(0, 2).every((r) => r.includes('Coiffe Lardante'))).toBe(true);
    expect(results.slice(0, 2).join(' ')).toMatch(/Mythique[\s\S]*Légendaire|Légendaire[\s\S]*Mythique/);
    await page.locator('.search-results li[role=option]', { hasText: 'Légendaire' }).first().click();
    await page.waitForSelector('.target');
    expect(await page.locator('.target .meta').innerText()).toContain('Légendaire');
  });

  it('liste de courses conforme à T1a', async () => {
    await page.getByRole('tab', { name: 'Courses' }).click();
    expect(await shopping()).toEqual([
      'Boolet=70',
      'Eclat de Taroudium=5',
      'Fayot=45',
      "Feuille d'Aloa Vero=70",
      'Krak-Ertz=35',
      'Poudre=21',
      'Sang du Dragon-Cochon=5',
      'Sioupère-Glou Durable=40',
      'Truffe Aromatisée=5',
      'Truffe du Désert=45',
    ]);
  });

  it('cocher Krak-Ertz dans les courses le coche dans toutes les occurrences de l\'arbre', async () => {
    await toggleHave('Krak-Ertz');
    await page.getByRole('tab', { name: 'Arbre' }).click();
    const rows = page.locator('.row').filter({ has: page.locator('.item-name', { hasText: /^Krak-Ertz$/ }) });
    expect(await rows.count()).toBe(2);
    for (const row of await rows.all()) expect(await row.locator('input[type=checkbox]').isChecked()).toBe(true);
    await toggleHave('Krak-Ertz');
  });

  it('variante R7362 de l\'Orbe Durable appliquée aux deux occurrences', async () => {
    await page.locator('.row', { hasText: 'Orbe Durable' }).first().locator('select').nth(1).selectOption('7362');
    const names = await texts('.row .item-name');
    expect(names.filter((n) => n === 'Fil de serrage')).toHaveLength(2);
    expect(names).not.toContain('Krak-Ertz');
  });

  it('ordre de craft : intermédiaires d\'abord, puis les deux coiffes', async () => {
    await page.getByRole('tab', { name: 'Ordre' }).click();
    expect(await texts('.order-row .item-name')).toEqual([
      'Orbe Durable',
      'Fil Durable',
      'Fibre Durable',
      'Coiffe Lardante',
      'Coiffe Lardante',
    ]);
  });

  it('mode compact, puis retour au mode normal', async () => {
    await page.evaluate('window.api.setCompact(true)');
    await page.waitForSelector('.app.compact');
    await page.evaluate('window.api.setCompact(false)');
    await page.waitForSelector('.app:not(.compact)');
  });

  it('réglages : « Modifier » puis la combinaison au clavier change le raccourci, sans cliquer dans le cadre', async () => {
    await page.getByRole('button', { name: 'Réglages' }).click();
    await page.getByRole('button', { name: 'Modifier' }).click();
    await page.keyboard.press('Control+Shift+F9');
    await expect.poll(() => page.locator('.hotkey').innerText()).toBe('Ctrl+Maj+F9');
    await page.getByRole('button', { name: 'Fermer' }).click();
  });

  it('liste restaurée au redémarrage (objet, vue, variante)', async () => {
    await close();
    await launch();
    expect(await page.locator('.target .meta').innerText()).toContain('Légendaire');
    expect(await page.locator('.tabs .active').innerText()).toBe('Ordre');
    await page.getByRole('tab', { name: 'Arbre' }).click();
    expect((await texts('.row .item-name')).filter((n) => n === 'Fil de serrage')).toHaveLength(2);
  });

  it("langue : l'anglais choisi dans les réglages traduit l'interface et les noms du jeu, et reste au redémarrage", async () => {
    await page.getByRole('button', { name: 'Réglages' }).click();
    await page.getByLabel('Langue').selectOption('en');
    await expect.poll(() => page.locator('.settings h2').innerText()).toBe('Settings');
    expect(await page.locator('.hotkey').innerText()).toBe('Ctrl+Shift+F9');
    await page.getByRole('button', { name: 'Close' }).click();
    expect(await page.locator('.target .item-name').innerText()).toBe('Larduous Hat');
    expect(await page.locator('.target .meta').innerText()).toBe('Lvl. 125 · Legendary · Helmet');
    expect(await page.locator('.tabs .active').innerText()).toBe('Tree');
    expect((await texts('.row .item-name')).filter((n) => n === 'Tensioning Wire')).toHaveLength(2);
    // Recherche sur les noms anglais.
    await page.locator('input[type=search]').fill('durable orb');
    await page.waitForSelector('.search-results li[role=option]');
    expect((await texts('.search-results li[role=option] .item-name'))[0]).toBe('Durable Orb');
    await page.keyboard.press('Escape');

    await close();
    await launch();
    expect(await page.locator('.target .item-name').innerText()).toBe('Larduous Hat');
    expect(await page.locator('.status').innerText()).toContain('Data 1.93.1.62');
  });

  it('crafts par métier : filtrés par niveau (retenu au redémarrage), un clic prépare le craft', async () => {
    const openTailor = async () => {
      await page.getByRole('button', { name: 'Professions' }).click();
      await page.getByLabel('Profession').selectOption({ label: 'Tailor' });
    };
    await openTailor();
    // Texte brut : les titres sont affichés en majuscules (CSS).
    expect(await page.locator('.jobs h3').allTextContents()).toEqual(['Tailor lvl. 70', 'Tailor lvl. 78', 'Tailor lvl. 80']);
    expect(await texts('.job-craft .item-name')).toEqual(['Durable Fiber', 'Larduous Hat', 'Larduous Hat']);
    await page.getByLabel('My level').fill('78');
    expect(await page.locator('.jobs-count').innerText()).toBe('2 of 3 crafts');
    expect(await texts('.job-craft .item-name')).toEqual(['Durable Fiber', 'Larduous Hat']);

    await close();
    await launch();
    await openTailor();
    expect(await page.getByLabel('My level').inputValue()).toBe('78');
    await page.locator('.job-craft', { hasText: 'Larduous Hat' }).click();
    expect(await page.locator('.jobs').count()).toBe(0);
    expect(await page.locator('.target .meta').innerText()).toBe('Lvl. 122 · Mythical · Helmet');
  });

  it('plan requis : badge dans les crafts par métier, puis « Requires » dans l\'arbre et l\'ordre', async () => {
    await page.getByRole('button', { name: 'Professions' }).click();
    await page.getByLabel('Profession').selectOption({ label: 'Leather Dealer' });
    const rows = page.locator('.job-craft', { hasText: 'Kokoncord' });
    expect(await rows.count()).toBe(3);
    for (const row of await rows.all()) expect(await row.locator('.badge').allInnerTexts()).toContain('blueprint');
    const badge = rows.first().locator('.badge', { hasText: 'blueprint' });
    expect(await badge.getAttribute('title')).toBe('Requires: "Kokoncord" Blueprint');
    // Niveau 116 : la Rare, recette sans amélioration.
    await rows.first().click();
    expect(await page.locator('.target .meta').innerText()).toContain('Rare');
    expect(await texts('.row .plan')).toEqual(['Requires: "Kokoncord" Blueprint']);
    await page.getByRole('tab', { name: 'Order' }).click();
    expect(await texts('.order-row .plan')).toEqual(['Requires: "Kokoncord" Blueprint']);
  });

  it('retour : un objet ouvert par mégarde depuis les métiers ramène aux métiers puis à la liste d\'avant, sans trace dans les récents', async () => {
    const target = () => page.locator('.target .item-name').innerText();
    expect(await target()).toBe('Kokoncord');
    await page.getByRole('button', { name: 'Professions' }).click();
    await page.getByLabel('Profession').selectOption({ label: 'Tailor' });
    // Fenêtre basse pour que la liste défile : défilée jusqu'en bas, puis clic sans la faire défiler.
    await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(420, 300));
    const jobsList = page.locator('.jobs-list');
    await expect.poll(() => jobsList.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const scrolled = await jobsList.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return el.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);
    await page.locator('.job-craft', { hasText: 'Durable Fiber' }).evaluate((el) => (el as unknown as { click(): void }).click());
    expect(await target()).toBe('Durable Fiber');

    // Alt+← : comme le bouton Retour. Les métiers reviennent tels qu'on les a laissés, défilement compris.
    await page.keyboard.press('Alt+ArrowLeft');
    await page.waitForSelector('.jobs');
    expect(await page.getByLabel('Profession').inputValue()).toBe('79');
    expect(await jobsList.evaluate((el) => el.scrollTop)).toBe(scrolled);
    await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(420, 640));
    await page.getByRole('button', { name: 'Back' }).click();
    expect(await page.locator('.jobs').count()).toBe(0);
    expect(await target()).toBe('Kokoncord');
    await page.getByRole('button', { name: 'Recent' }).click();
    expect(await texts('.history-menu .item-name')).not.toContain('Durable Fiber');
    await page.keyboard.press('Escape');

    // Bouton « précédent » de la souris : écran d'avant, les métiers ouverts avant de choisir Kokoncord, avec la
    // liste d'alors (la Coiffe Lardante mythique).
    await page.evaluate("window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }))");
    await page.waitForSelector('.jobs');
    await page.locator('.jobs .close').click();
    expect(await target()).toBe('Larduous Hat');
    expect(await page.locator('.target .meta').innerText()).toContain('Mythical');
  });

  it('aucune erreur dans la console du panneau', () => {
    expect(consoleErrors).toEqual([]);
  });
});
