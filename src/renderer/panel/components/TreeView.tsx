// Arbre de craft : chaque nœud avec sa case « je l'ai », crafter / acheter et le choix de variante.
import type { GameIndex, Recipe } from '../../../core/data/loadIndex';
import type { Messages } from '../../../core/i18n';
import type { NeedNode, NeedsResult } from '../../../core/needs/computeNeeds';
import { hasAll, setMode, toggleCollapsed, toggleHave, type CraftList } from '../../../core/state/craftList';
import { selectRecipe, updateList, useMessages, type Catalog } from '../store';
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

/** « Ébéniste niv. 75 » */
export function recipeLabel(index: GameIndex, recipe: Recipe, m: Messages): string {
  const job = index.jobs.get(recipe.jobId) ?? m.tree.unknownJob(recipe.jobId);
  return m.tree.recipe(job, recipe.jobLevel);
}

function ingredientsLabel(index: GameIndex, recipe: Recipe): string {
  return recipe.ings.map((g) => `${index.items.get(g.itemId)?.name ?? `#${g.itemId}`} ×${g.qty}`).join(', ');
}

function detail(index: GameIndex, node: NeedNode, m: Messages): string {
  const t = m.tree;
  const stock = node.fromStock > 0 && node.kind !== 'stock' ? ` · ${t.fromStock(node.fromStock)}` : '';
  switch (node.kind) {
    case 'craft': {
      const recipe = node.recipe!;
      const perCraft = recipe.yield > 1 ? ` ${t.perCraft(recipe.yield)}` : '';
      return `${t.crafts(node.crafts)}${perCraft} · ${recipeLabel(index, recipe, m)}${stock}`;
    }
    case 'stock':
      return t.stock;
    case 'base':
      return `${t.toObtain(node.toObtain)}${stock}`;
    case 'buy':
      return `${t.toBuy(node.toObtain)}${stock}`;
    case 'cycle':
      return t.cycle(node.toObtain);
  }
}

function TreeNode({ node, depth, catalog, list, result }: TreeProps & { node: NeedNode; depth: number }) {
  const m = useMessages();
  const t = m.tree;
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
          aria-label={collapsed ? t.expand : t.collapse}
          onClick={() => updateList((l) => toggleCollapsed(l, node.key))}
        >
          {hasChildren ? (collapsed ? '▸' : '▾') : ''}
        </button>
        <input
          type="checkbox"
          checked={hasAll(list, node.itemId, demand)}
          title={t.haveTotal(demand)}
          onChange={() => updateList((l) => toggleHave(l, node.itemId, demand))}
        />
        <ItemIcon item={item} />
        <div className="row-main">
          <div className="row-title">
            <ItemName item={item} itemId={node.itemId} />
            <span className="qty">×{node.qty}</span>
            {node.recipe?.isUpgrade && <span className="badge">{m.common.upgrade}</span>}
          </div>
          <div className="row-detail">
            <span>{detail(index, node, m)}</span>
            {showControls && (
              <span className="row-controls">
                {depth > 0 && (
                  <select
                    value={buying ? 'buy' : 'craft'}
                    title={t.modeTitle}
                    onChange={(event) => updateList((l) => setMode(l, node.itemId, event.target.value === 'buy' ? 'buy' : 'craft'))}
                  >
                    <option value="craft">{t.craft}</option>
                    <option value="buy">{t.buy}</option>
                  </select>
                )}
                {!buying && recipes.length > 1 && node.recipe && (
                  <select
                    value={node.recipe.id}
                    title={t.variantTitle}
                    onChange={(event) => selectRecipe(node.itemId, Number(event.target.value))}
                  >
                    {recipes.map((r, i) => (
                      <option key={r.id} value={r.id}>
                        {t.variant(i + 1, i === 0, ingredientsLabel(index, r))}
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
