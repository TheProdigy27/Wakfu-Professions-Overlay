// Coût de revient d'une liste d'après les prix de l'HDV saisis à la main, et comparaison crafter / acheter par objet.
// Ce qui est possédé ne coûte rien : on compte les kamas à dépenser pour ce qui reste à obtenir.
import type { GameIndex } from '../data/loadIndex';
import { computeNeeds, type NeedNode, type NeedsInput, type NeedsResult } from './computeNeeds';

export const MAX_PRICE = 999_999_999;
/** Au-delà, un prix est signalé comme ancien : ceux de l'HDV changent vite. */
export const STALE_DAYS = 7;

export interface Price {
  /** Prix unitaire, en kamas. */
  kamas: number;
  /** Date de saisie (ISO). */
  at: string;
}

/** itemId → prix unitaire à l'HDV, commun à toutes les listes. */
export type Prices = Record<number, Price>;

/** Prix saisi ; null (champ vidé) l'oublie. 0 est un prix : ressource récoltée soi-même, par exemple. */
export function withPrice(prices: Prices, itemId: number, kamas: number | null, now = new Date()): Prices {
  const next = { ...prices };
  if (kamas === null || !Number.isFinite(kamas)) delete next[itemId];
  else next[itemId] = { kamas: Math.min(MAX_PRICE, Math.max(0, Math.floor(kamas))), at: now.toISOString() };
  return next;
}

/** Jours écoulés depuis la saisie, d'après le calendrier local : 0 le jour même, 1 la veille. */
export function priceAge(price: Price, now = new Date()): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const at = new Date(price.at);
  if (Number.isNaN(at.getTime())) return 0;
  return Math.max(0, Math.round((day(now) - day(at)) / 86_400_000));
}

export interface Cost {
  /** Kamas à dépenser pour les objets qui ont un prix. */
  kamas: number;
  /** Objets à obtenir qui ont un prix. */
  priced: number;
  /** Objets à obtenir sans prix, par id : `kamas` n'est alors qu'un minimum. */
  unpriced: number[];
}

/** Ce que coûte un objet selon qu'on le crafte ou qu'on l'achète, pour toute la liste. */
export interface CraftOrBuy {
  craft: Cost;
  buy: Cost;
  /** Quantité à acheter si on l'achète. */
  qty: number;
}

export interface ListCost {
  /** Tout ce qui reste à obtenir. */
  total: Cost;
  /** Par objet crafté ou acheté de l'arbre ; vide tant qu'aucun prix n'est saisi. */
  choices: Map<number, CraftOrBuy>;
}

/** Coût de quantités à obtenir (itemId → quantité ; celles ≤ 0 ne comptent pas). */
function obtainCost(quantities: Iterable<readonly [number, number]>, prices: Prices): Cost {
  const cost: Cost = { kamas: 0, priced: 0, unpriced: [] };
  for (const [itemId, qty] of quantities) {
    if (qty <= 0) continue;
    const price = prices[itemId];
    if (!price) {
      cost.unpriced.push(itemId);
      continue;
    }
    cost.kamas += qty * price.kamas;
    cost.priced++;
  }
  cost.unpriced.sort((a, b) => a - b);
  return cost;
}

function toObtain(result: NeedsResult): Map<number, number> {
  return new Map([...result.totals].map(([itemId, t]) => [itemId, t.toObtain]));
}

/** Ce que `a` fait obtenir en plus de `b`, objet par objet. */
function extra(a: ReadonlyMap<number, number>, b: ReadonlyMap<number, number>): [number, number][] {
  return [...a].map(([itemId, qty]) => [itemId, qty - (b.get(itemId) ?? 0)]);
}

/**
 * Crafter ou acheter un objet : la liste est recalculée avec l'autre choix, et chaque option coûte ce qu'elle fait
 * obtenir en plus de l'autre. Le stock partagé et le surplus des crafts sont ainsi pris en compte, et l'option la
 * moins chère est exactement celle qui rend la liste moins chère.
 */
export function listCost(index: GameIndex, input: NeedsInput, result: NeedsResult, prices: Prices): ListCost {
  const current = toObtain(result);
  const total = obtainCost(current, prices);
  const choices = new Map<number, CraftOrBuy>();
  if (Object.keys(prices).length === 0) return { total, choices };

  const items = new Set<number>();
  const walk = (node: NeedNode): void => {
    if (node.kind === 'craft' || node.kind === 'buy') items.add(node.itemId);
    node.children.forEach(walk);
  };
  result.roots.forEach(walk);

  for (const itemId of items) {
    const buying = input.mode?.[itemId] === 'buy';
    const mode: Record<number, 'buy'> = { ...input.mode };
    if (buying) delete mode[itemId];
    else mode[itemId] = 'buy';
    const other = toObtain(computeNeeds(index, { ...input, mode }));
    const [crafted, bought] = buying ? [other, current] : [current, other];
    choices.set(itemId, {
      craft: obtainCost(extra(crafted, bought), prices),
      buy: obtainCost(extra(bought, crafted), prices),
      qty: (bought.get(itemId) ?? 0) - (crafted.get(itemId) ?? 0),
    });
  }
  return { total, choices };
}
