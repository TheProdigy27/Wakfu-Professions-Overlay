// Ordre de craft : par étape (intermédiaires d'abord), puis métier, puis niveau.
import type { NeedsResult } from '../../../core/needs/computeNeeds';
import { craftOrder, type CraftStep } from '../../../core/needs/craftOrder';
import type { Catalog } from '../store';
import { ItemIcon, ItemName } from './Item';
import { recipeLabel } from './TreeView';

export function CraftOrder({ catalog, result }: { catalog: Catalog; result: NeedsResult }) {
  const steps = craftOrder(catalog.index, result);
  if (steps.length === 0) return <p className="empty">Rien à crafter : tout est en stock ou acheté.</p>;

  const byHeight = new Map<number, CraftStep[]>();
  for (const step of steps) byHeight.set(step.height, [...(byHeight.get(step.height) ?? []), step]);

  return (
    <div className="order">
      {[...byHeight].map(([height, group]) => (
        <section key={height}>
          <h3>Étape {height}</h3>
          <ul>
            {group.map((step) => {
              const item = catalog.index.items.get(step.itemId);
              return (
                <li key={step.itemId} className="order-row">
                  <ItemIcon item={item} />
                  <ItemName item={item} itemId={step.itemId} />
                  <span className="qty">×{step.crafts}</span>
                  <span className="meta">{recipeLabel(catalog.index, step.recipe)}</span>
                  {step.recipe.isUpgrade && <span className="badge">amélioration</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
