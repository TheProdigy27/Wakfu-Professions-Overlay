// Listes mises à jour d'après le chat de Wakfu : objets ramassés ou perdus en jeu, crafts réussis.
import type { Names } from '../data/indexFile';
import type { GameIndex, Ingredient, Recipe } from '../data/loadIndex';
import { LOCALES, type Locale } from '../i18n/locale';
import { addOwned, treeItemIds, type CraftList } from '../state/craftList';
import type { ChatCraft, ChatEvent, ChatItemChange } from './chatLine';

/**
 * Le chat ne donne que le nom de l'objet : il est cherché parmi les objets de l'arbre de la liste, dans la langue du
 * client de jeu. Un nom absent de l'arbre est ignoré, comme un nom porté par plusieurs de ses objets (même équipement
 * en plusieurs raretés dans une chaîne d'amélioration). Renvoie la même liste si rien ne change.
 */
export function applyChatChanges(
  list: CraftList,
  changes: readonly ChatItemChange[],
  names: (itemId: number) => Names | undefined,
  now = new Date(),
): CraftList {
  const ids = [...treeItemIds(list)];
  let next = list;
  for (const change of changes) {
    const matches = namedIn(ids, change.locale, change.name, names);
    if (matches.length !== 1) continue;
    const updated = addOwned(next, matches[0]!, change.qty, now);
    if (updated.owned[matches[0]!] !== next.owned[matches[0]!]) next = updated;
  }
  return next;
}

function namedIn(
  ids: readonly number[],
  locale: Locale,
  name: string,
  names: (itemId: number) => Names | undefined,
): number[] {
  const lang = LOCALES.indexOf(locale);
  return ids.filter((id) => names(id)?.[lang]?.trim() === name);
}

/** Noms et recettes des objets du jeu, pour reconnaître l'objet d'un craft du chat. */
export interface ChatLookup {
  /** Noms dans les quatre langues. */
  names(itemId: number): Names | undefined;
  /** Objets craftables qui portent ce nom dans cette langue. */
  craftable(locale: Locale, name: string): readonly number[];
  recipes(itemId: number): readonly Recipe[];
}

/** index : n'importe quelle langue (seules ses recettes servent) ; names : noms des objets dans les quatre langues. */
export function createChatLookup(index: GameIndex, names: (itemId: number) => Names | undefined): ChatLookup {
  const byName = new Map<Locale, Map<string, number[]>>();
  return {
    names,
    recipes: (itemId) => index.recipesByItem.get(itemId) ?? [],
    craftable(locale, name) {
      let map = byName.get(locale);
      if (!map) {
        map = new Map();
        const lang = LOCALES.indexOf(locale);
        for (const itemId of index.recipesByItem.keys()) {
          const key = names(itemId)?.[lang]?.trim();
          if (!key) continue;
          const ids = map.get(key);
          if (ids) ids.push(itemId);
          else map.set(key, [itemId]);
        }
        byName.set(locale, map);
      }
      return map.get(name) ?? [];
    },
  };
}

/** Recette reconnue aux objets perdus d'un craft du chat. */
export interface RecipeMatch {
  recipe: Recipe;
  /** Crafts faits d'un coup. */
  crafts: number;
  /** Objets de base d'une amélioration : le jeu n'écrit pas leur perte, il les transforme en l'objet amélioré. */
  unlogged: Ingredient[];
}

export interface Crafted {
  itemId: number;
  /** Exemplaires fabriqués (ramassés). */
  qty: number;
  /** Absente quand l'objet n'est reconnu qu'à son nom. */
  match?: RecipeMatch;
}

/**
 * Objet fabriqué par un craft du chat. Le nom ne suffit pas toujours : les raretés d'un même équipement portent le même
 * nom, et l'une sert d'ingrédient à l'autre. Les objets perdus départagent (matchRecipe). null si aucun objet ne
 * correspond, ou s'il en reste plusieurs.
 */
export function craftedItem(craft: ChatCraft, lookup: ChatLookup): Crafted | null {
  const candidates = lookup.craftable(craft.locale, craft.name);
  if (candidates.length === 0) return null;
  const lost = new Map<string, number>();
  for (const line of craft.items) if (line.qty < 0) lost.set(line.name, (lost.get(line.name) ?? 0) - line.qty);
  const qty = craft.items.findLast((line) => line.qty > 0 && line.name === craft.name)?.qty ?? 0;
  const matches = candidates.flatMap((itemId) =>
    lookup.recipes(itemId).flatMap((recipe) => {
      const match = matchRecipe(recipe, lost, qty, craft.locale, lookup);
      return match ? [{ itemId, qty, match }] : [];
    }),
  );
  if (new Set(matches.map((m) => m.itemId)).size === 1) return matches[0]!;
  if (matches.length === 0 && candidates.length === 1) return { itemId: candidates[0]!, qty };
  return null;
}

/**
 * Les objets perdus sont les ingrédients de la recette, chacun en quantité de la recette × nombre de crafts faits d'un
 * coup : celui des exemplaires ramassés quand on les connaît. Seul peut manquer, dans une amélioration, un ingrédient
 * à 1 exemplaire : l'objet de base, que le jeu transforme en l'objet amélioré sans l'écrire dans le chat.
 */
function matchRecipe(
  recipe: Recipe,
  lost: ReadonlyMap<string, number>,
  qty: number,
  locale: Locale,
  lookup: ChatLookup,
): RecipeMatch | null {
  const lang = LOCALES.indexOf(locale);
  const needed = new Map<string, Ingredient[]>();
  for (const ing of recipe.ings) {
    const name = lookup.names(ing.itemId)?.[lang]?.trim();
    if (!name) return null;
    needed.set(name, [...(needed.get(name) ?? []), ing]);
  }
  if ([...lost.keys()].some((name) => !needed.has(name))) return null;
  let crafts = qty > 0 ? qty / recipe.yield : 0;
  if (!Number.isInteger(crafts)) return null;
  let unlogged: Ingredient[] = [];
  for (const [name, ings] of needed) {
    const total = lost.get(name);
    if (total === undefined) {
      if (!recipe.isUpgrade || unlogged.length > 0 || ings.length !== 1 || ings[0]!.qty !== 1) return null;
      unlogged = ings;
      continue;
    }
    const per = ings.reduce((sum, ing) => sum + ing.qty, 0);
    if (total % per !== 0 || (crafts !== 0 && total / per !== crafts)) return null;
    crafts = total / per;
  }
  return crafts > 0 ? { recipe, crafts, unlogged } : null;
}

/**
 * Ce que le nom seul n'a pas attribué, parce que plusieurs objets de l'arbre le portent : l'objet fabriqué ramassé, les
 * ingrédients perdus ; et l'objet de base d'une amélioration, dont le chat ne dit rien. Un objet fabriqué compté pour
 * un homonyme de l'arbre, qui n'est pas celui du craft, lui est retiré.
 */
function applyCraft(
  list: CraftList,
  craft: ChatCraft,
  crafted: Crafted,
  names: (itemId: number) => Names | undefined,
  now: Date,
): CraftList {
  const ids = [...treeItemIds(list)];
  const lang = LOCALES.indexOf(craft.locale);
  let next = list;
  for (const line of craft.items) {
    const itemId =
      line.qty > 0
        ? line.name === craft.name
          ? crafted.itemId
          : undefined
        : ingredientNamed(crafted.match?.recipe, line.name, lang, names);
    if (itemId === undefined) continue;
    const matches = namedIn(ids, craft.locale, line.name, names);
    if (matches.length === 1) {
      if (line.qty > 0 && matches[0] !== itemId) next = addOwned(next, matches[0]!, -line.qty, now);
    } else if (matches.includes(itemId)) {
      next = addOwned(next, itemId, line.qty, now);
    }
  }
  for (const ing of crafted.match?.unlogged ?? []) {
    if (ids.includes(ing.itemId)) next = addOwned(next, ing.itemId, -ing.qty * crafted.match!.crafts, now);
  }
  return next;
}

function ingredientNamed(
  recipe: Recipe | undefined,
  name: string,
  lang: number,
  names: (itemId: number) => Names | undefined,
): number | undefined {
  const ids = new Set(recipe?.ings.filter((ing) => names(ing.itemId)?.[lang]?.trim() === name).map((ing) => ing.itemId));
  return ids.size === 1 ? [...ids][0] : undefined;
}

export interface ChatResult {
  /** Liste en cours ; null si son objet vient d'être crafté dans la quantité voulue. */
  list: CraftList | null;
  history: CraftList[];
  /** Listes terminées par un craft : retirées de l'écran et des récents, qui ne gardent que les crafts à faire. */
  done: CraftList[];
}

/**
 * Évènements du chat, dans l'ordre : les objets ramassés ou perdus mettent à jour les quantités possédées de la liste en
 * cours (null : aucune, ou en lecture seule) ; un craft de l'objet d'une liste la termine quand il en donne la quantité
 * voulue. Les listes des récents ne suivent pas le chat : seul le craft lui-même compte pour elles.
 * Renvoie les mêmes listes et le même historique si rien ne change.
 */
export function applyChatEvents(
  list: CraftList | null,
  history: CraftList[],
  events: readonly ChatEvent[],
  lookup: ChatLookup,
  now = new Date(),
): ChatResult {
  let current = list;
  let recent = history;
  const done: CraftList[] = [];
  for (const event of events) {
    if (event.kind === 'item') {
      if (current) current = applyChatChanges(current, [event], lookup.names, now);
      continue;
    }
    const crafted = craftedItem(event, lookup);
    if (!crafted) continue;
    if (current) {
      current = applyCraft(current, event, crafted, lookup.names, now);
      if (current.target.itemId === crafted.itemId && (current.owned[crafted.itemId] ?? 0) >= current.target.qty) {
        done.push(current);
        current = null;
      }
    }
    const finished = recent.filter(
      (l) => l.target.itemId === crafted.itemId && (l.owned[crafted.itemId] ?? 0) + crafted.qty >= l.target.qty,
    );
    if (finished.length > 0) {
      done.push(...finished);
      recent = recent.filter((l) => !finished.includes(l));
    }
  }
  return { list: current, history: recent, done };
}
