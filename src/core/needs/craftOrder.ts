// Ordre de craft conseillé : intermédiaires d'abord, puis métier, puis niveau.
import type { GameIndex, Recipe } from '../data/loadIndex';
import type { NeedNode, NeedsResult } from './computeNeeds';

export interface CraftStep {
  itemId: number;
  crafts: number;
  recipe: Recipe;
  /** 1 pour un objet dont aucun ingrédient n'est crafté, sinon 1 + la hauteur maximale de ses ingrédients craftés. */
  height: number;
}

export function craftOrder(index: GameIndex, result: NeedsResult): CraftStep[] {
  // Graphe des objets craftés, toutes occurrences confondues.
  const edges = new Map<number, Set<number>>();
  const recipeOf = new Map<number, Recipe>();
  const collect = (node: NeedNode): void => {
    if (!node.recipe) return;
    recipeOf.set(node.itemId, node.recipe);
    let set = edges.get(node.itemId);
    if (!set) edges.set(node.itemId, (set = new Set()));
    for (const child of node.children) {
      if (child.recipe) set.add(child.itemId);
      collect(child);
    }
  };
  result.roots.forEach(collect);

  // Les cycles sont coupés par computeNeeds : ce graphe est acyclique.
  const height = new Map<number, number>();
  const heightOf = (id: number): number => {
    const known = height.get(id);
    if (known !== undefined) return known;
    let max = 0;
    for (const child of edges.get(id) ?? []) max = Math.max(max, heightOf(child));
    height.set(id, max + 1);
    return max + 1;
  };

  const job = (r: Recipe) => index.jobs.get(r.jobId) ?? '';
  return [...edges.keys()]
    .map((itemId) => ({
      itemId,
      crafts: result.totals.get(itemId)!.crafts,
      recipe: recipeOf.get(itemId)!,
      height: heightOf(itemId),
    }))
    .sort(
      (a, b) =>
        a.height - b.height ||
        job(a.recipe).localeCompare(job(b.recipe), index.locale) ||
        a.recipe.jobLevel - b.recipe.jobLevel ||
        a.itemId - b.itemId,
    );
}
