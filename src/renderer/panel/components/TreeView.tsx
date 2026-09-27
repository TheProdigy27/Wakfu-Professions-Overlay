// Arbre de craft : chaque nœud avec sa case « je l'ai », crafter / acheter et le choix de variante.
import type { GameIndex, Recipe } from '../../../core/data/loadIndex';
import type { NeedNode, NeedsResult } from '../../../core/needs/computeNeeds';
import { hasAll, setMode, toggleCollapsed, toggleHave, type CraftList } from '../../../core/state/craftList';
import { selectRecipe, updateList, type Catalog } from '../store';
import { ItemIcon, ItemName } from './Item';

interface TreeProps {
  catalog: Catalog;
  list: CraftList;
  result: NeedsResult;
}

export function TreeView(props: TreeProps) {
  return (
    <ul className="tree">
      {props.result.roots.map((node) => (
        <TreeNode key={node.key} node={node} depth={0} {...props} />
      ))}
    </ul>
  );
}

export function recipeLabel(index: GameIndex, recipe: Recipe): string {
  const job = index.jobs.get(recipe.jobId) ?? `Métier #${recipe.jobId}`;
  return `${job} niv. ${recipe.jobLevel}`;
}

function ingredientsLabel(index: GameIndex, recipe: Recipe): string {
  return recipe.ings.map((g) => `${index.items.get(g.itemId)?.name ?? `#${g.itemId}`} ×${g.qty}`).join(', ');
}

function detail(index: GameIndex, node: NeedNode): string {
  const stock = node.fromStock > 0 && node.kind !== 'stock' ? ` · ${node.fromStock} en stock` : '';
  switch (node.kind) {
    case 'craft': {
      const recipe = node.recipe!;
      const perCraft = recipe.yield > 1 ? ` (${recipe.yield} par craft)` : '';
      return `${node.crafts} craft${node.crafts > 1 ? 's' : ''}${perCraft} · ${recipeLabel(index, recipe)}${stock}`;
    }
    case 'stock':
      return 'En stock';
    case 'base':
      return `À obtenir : ${node.toObtain}${stock}`;
    case 'buy':
      return `À acheter : ${node.toObtain}${stock}`;
    case 'cycle':
      return `Recette circulaire, à obtenir : ${node.toObtain}`;
  }
}

function TreeNode({ node, depth, catalog, list, result }: TreeProps & { node: NeedNode; depth: number }) {
  const { index } = catalog;
  const item = index.items.get(node.itemId);
  const recipes = index.recipesByItem.get(node.itemId) ?? [];
  const demand = result.totals.get(node.itemId)?.demand ?? 0;
  const collapsed = list.ui.collapsed.includes(node.key);
  const buying = list.mode[node.itemId] === 'buy';
  const hasChildren = node.children.length > 0;
  const showControls = recipes.length > 0 && node.kind !== 'stock';

  return (
    <li>
      <div className={`row kind-${node.kind}`} style={{ paddingLeft: depth * 14 + 4 }}>
        <button
          type="button"
          className="twisty"
          disabled={!hasChildren}
          aria-label={collapsed ? 'Déplier' : 'Replier'}
          onClick={() => updateList((l) => toggleCollapsed(l, node.key))}
        >
          {hasChildren ? (collapsed ? '▸' : '▾') : ''}
        </button>
        <input
          type="checkbox"
          checked={hasAll(list, node.itemId, demand)}
          title={`Je l'ai (${demand} au total)`}
          onChange={() => updateList((l) => toggleHave(l, node.itemId, demand))}
        />
        <ItemIcon item={item} />
        <div className="row-main">
          <div className="row-title">
            <ItemName item={item} itemId={node.itemId} />
            <span className="qty">×{node.qty}</span>
            {node.recipe?.isUpgrade && <span className="badge">amélioration</span>}
          </div>
          <div className="row-detail">
            <span>{detail(index, node)}</span>
            {showControls && (
              <span className="row-controls">
                {depth > 0 && (
                  <select
                    value={buying ? 'buy' : 'craft'}
                    title="Crafter ou acheter cet intermédiaire"
                    onChange={(event) => updateList((l) => setMode(l, node.itemId, event.target.value === 'buy' ? 'buy' : 'craft'))}
                  >
                    <option value="craft">Je le crafte</option>
                    <option value="buy">J'achète</option>
                  </select>
                )}
                {!buying && recipes.length > 1 && node.recipe && (
                  <select
                    value={node.recipe.id}
                    title="Variante de recette (le choix est mémorisé pour cet objet)"
                    onChange={(event) => selectRecipe(node.itemId, Number(event.target.value))}
                  >
                    {recipes.map((r, i) => (
                      <option key={r.id} value={r.id}>
                        {`Variante ${i + 1}${i === 0 ? ' (par défaut)' : ''} : ${ingredientsLabel(index, r)}`}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      {hasChildren && !collapsed && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.key} node={child} depth={depth + 1} catalog={catalog} list={list} result={result} />
          ))}
        </ul>
      )}
    </li>
  );
}
