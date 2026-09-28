// Prix de l'HDV saisis à la main : champ du prix unitaire, coût de revient de la liste, comparaison crafter / acheter.
import type { GameIndex } from '../../../core/data/loadIndex';
import type { Messages } from '../../../core/i18n';
import { MAX_PRICE, priceAge, STALE_DAYS, type Cost, type CraftOrBuy } from '../../../core/needs/cost';
import { setPrice, useMessages, usePanel } from '../store';

/** Au-delà, les objets sans prix sont résumés par « … » dans l'infobulle. */
const MAX_NAMES = 10;

/** « 12 400 kamas », « ≥ 12 400 kamas » s'il manque des prix, « ? » si aucun objet concerné n'a de prix. */
function amount(cost: Cost, m: Messages): string {
  if (cost.unpriced.length === 0) return m.cost.kamas(cost.kamas);
  return cost.priced > 0 ? m.cost.atLeast(m.cost.kamas(cost.kamas)) : m.cost.unknown;
}

function unpricedTitle(index: GameIndex, cost: Cost, m: Messages): string | undefined {
  if (cost.unpriced.length === 0) return undefined;
  const names = cost.unpriced.slice(0, MAX_NAMES).map((id) => index.items.get(id)?.name ?? m.common.unknownItem(id));
  if (cost.unpriced.length > MAX_NAMES) names.push('…');
  return m.cost.unpricedTitle(names.join(', '));
}

/** Prix unitaire d'un objet, commun à toutes les listes ; vider le champ oublie le prix. */
export function PriceInput({ itemId, toObtain, placeholder }: { itemId: number; toObtain: number; placeholder?: string }) {
  const m = useMessages();
  const t = m.cost;
  const price = usePanel((s) => s.prices[itemId]);
  const days = price ? priceAge(price) : null;
  const title = [
    t.price,
    days !== null && t.age(days),
    price && toObtain > 0 && t.line(toObtain, t.kamas(toObtain * price.kamas)),
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <input
      type="number"
      className={days !== null && days > STALE_DAYS ? 'price stale' : 'price'}
      min={0}
      max={MAX_PRICE}
      placeholder={placeholder}
      value={price?.kamas ?? ''}
      title={title}
      aria-label={t.columnTitle}
      onChange={(e) => setPrice(itemId, e.target.value === '' ? null : e.target.valueAsNumber)}
    />
  );
}

/** « Coût de revient : 45 300 kamas · 3 sans prix », dès qu'un objet à obtenir a un prix. */
export function TotalCost({ index, cost }: { index: GameIndex; cost: Cost }) {
  const m = useMessages();
  if (cost.priced === 0) return null;
  return (
    <span className="cost" title={unpricedTitle(index, cost, m)}>
      {m.cost.total(amount(cost, m))}
      {cost.unpriced.length > 0 && <span className="nowrap"> · {m.cost.unpriced(cost.unpriced.length)}</span>}
    </span>
  );
}

/**
 * « Crafter : 12 400 kamas · Acheter : 15 000 kamas », le moins cher en vert quand les deux sont connus. L'objet
 * compte pour toute la liste : « ×5 dans la liste » quand ce n'est pas la quantité de la ligne (`rowQty`).
 */
export function CraftOrBuyLine({ index, choice, rowQty }: { index: GameIndex; choice: CraftOrBuy; rowQty: number }) {
  const m = useMessages();
  const { craft, buy } = choice;
  if (craft.priced === 0 && buy.priced === 0) return null;
  const complete = craft.unpriced.length === 0 && buy.unpriced.length === 0;
  const part = (cost: Cost, text: string, cheaper: boolean) => (
    <span
      className={complete && cheaper ? 'cheaper' : undefined}
      title={[m.cost.compareTitle(choice.qty), unpricedTitle(index, cost, m)].filter(Boolean).join('\n')}
    >
      {text}
    </span>
  );
  return (
    <div className="row-cost">
      {choice.qty !== rowQty && <span title={m.cost.compareTitle(choice.qty)}>{m.cost.inList(choice.qty)}</span>}
      {part(craft, m.cost.craft(amount(craft, m)), craft.kamas < buy.kamas)}
      {part(buy, m.cost.buy(amount(buy, m)), buy.kamas < craft.kamas)}
    </div>
  );
}
