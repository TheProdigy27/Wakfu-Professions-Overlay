// Ordre de craft : par étape (intermédiaires d'abord), puis métier, puis niveau.
import type { NeedsResult } from '../../../core/needs/computeNeeds';
import { craftOrder, type CraftStep } from '../../../core/needs/craftOrder';
import { useMessages, type Catalog } from '../store';
import { ItemIcon, ItemName } from './Item';
import { recipeLabel } from './TreeView';

export function CraftOrder({ catalog, result }: { catalog: Catalog; result: NeedsResult }) {
  const m = useMessages();
  const steps = craftOrder(catalog.index, result);
  if (steps.length === 0) return <p className="empty">{m.order.nothing}</p>;

  const byHeight = new Map<number, CraftStep[]>();
  for (const step of steps) byHeight.set(step.height, [...(byHeight.get(step.height) ?? []), step]);

  return (
    <div className="order">
      {[...byHeight].map(([height, group]) => (
        <section key={height}>
          <h3>{m.order.step(height)}</h3>
          <ul>
            {group.map((step) => {
              const item = catalog.index.items.get(step.itemId);
              return (
                <li key={step.itemId} className="order-row">
                  <ItemIcon item={item} />
                  <ItemName item={item} itemId={step.itemId} />
                  <span className="qty">×{step.crafts}</span>
                  <span className="meta">{recipeLabel(catalog.index, step.recipe, m)}</span>
                  {step.recipe.isUpgrade && <span className="badge">{m.common.upgrade}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
