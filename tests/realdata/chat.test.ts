import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { craftedItem, createChatLookup, type ChatLookup } from '../../src/core/chat/applyChat';
import type { ChatItemChange } from '../../src/core/chat/chatLine';
import type { Names } from '../../src/core/data/indexFile';
import type { GameIndex } from '../../src/core/data/loadIndex';
import { LOCALES } from '../../src/core/i18n/locale';
import { buildRealIndex, REAL_DATA_VERSION, realRawDir } from '../helpers/realData';

let index: GameIndex;
let names: Map<number, Names>;
let lookup: ChatLookup;
/** recipeId → objet de base d'une amélioration (upgradeItemId des données brutes), absent de l'index. */
let upgradeBase: Map<number, number>;
beforeAll(async () => {
  const real = await buildRealIndex();
  index = real.index;
  names = new Map(real.file.items.map(([id, n]) => [id, n]));
  lookup = createChatLookup(index, (id) => names.get(id));
  const raw = JSON.parse(await readFile(path.join(realRawDir(), 'recipes.json'), 'utf8')) as {
    id: number;
    isUpgrade: boolean;
    upgradeItemId: number;
  }[];
  upgradeBase = new Map(raw.filter((r) => r.isUpgrade && r.upgradeItemId).map((r) => [r.id, r.upgradeItemId]));
});

describe(`données réelles ${REAL_DATA_VERSION} : objet fabriqué d'après le chat`, () => {
  /** Recettes dont le craft, dans chaque langue du client, n'est pas reconnu ; un objet reconnu est toujours le bon. */
  function unrecognized(logsBase: boolean): string[] {
    const unknown: string[] = [];
    for (const locale of LOCALES) {
      const lang = LOCALES.indexOf(locale);
      const name = (id: number) => names.get(id)![lang]!.trim();
      for (const recipe of index.recipes.values()) {
        // Deux crafts d'un coup : quantités doublées.
        const lost = recipe.ings.filter((ing) => logsBase || ing.itemId !== upgradeBase.get(recipe.id));
        const items: ChatItemChange[] = [
          ...lost.map((ing) => ({ locale, name: name(ing.itemId), qty: -2 * ing.qty })),
          { locale, name: name(recipe.out), qty: 2 * recipe.yield },
        ];
        const crafted = craftedItem({ locale, name: name(recipe.out), items }, lookup);
        if (crafted) expect(crafted.itemId, `${locale} R${recipe.id}`).toBe(recipe.out);
        else unknown.push(`${locale} ${name(recipe.out)} #${recipe.out}`);
      }
    }
    return unknown;
  }

  // En anglais, Ceinture Smare et Smaraboucle s'appellent toutes deux « Whirly Belt », avec la même recette.
  const WHIRLY_BELT = ['en Whirly Belt #21481', 'en Whirly Belt #21488'];

  it("comme l'écrit le jeu : l'objet de base d'une amélioration n'est pas annoncé perdu", () => {
    // En portugais, le Boulon légendaire consomme le Boulon mythique et des Bouboulons, tous nommés « Parafuso » : les
    // Parafuso perdus ne disent pas s'il manque l'objet de base.
    expect(unrecognized(false)).toEqual([...WHIRLY_BELT, 'pt Parafuso #23110']);
  });

  it('objet de base annoncé perdu lui aussi : même résultat', () => {
    expect(unrecognized(true)).toEqual(WHIRLY_BELT);
  });
});
