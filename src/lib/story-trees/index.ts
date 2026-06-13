import type { StoryTree } from "./types";
import { spaceTree } from "./space";
import { forestTree } from "./forest";
import { dinosaursTree } from "./dinosaurs";
import { piratesTree } from "./pirates";
import { superheroTree } from "./superhero";
import { chefTree } from "./chef";
import { castleTree } from "./castle";
import { safariTree } from "./safari";
import { inventorTree } from "./inventor";
import { candyTree } from "./candy";

export { tx } from "./types";
export type { StoryTree, TreeNode, TreeOption, LocalizedText, Locale } from "./types";

// Registry of branching story trees, keyed by templateId.
// A template without a tree here falls back to the legacy flat-decision flow.
export const STORY_TREES: Record<string, StoryTree> = {
  space: spaceTree,
  forest: forestTree,
  dinosaurs: dinosaursTree,
  pirates: piratesTree,
  superhero: superheroTree,
  chef: chefTree,
  castle: castleTree,
  safari: safariTree,
  inventor: inventorTree,
  candy: candyTree,
};

export function getStoryTree(templateId: string): StoryTree | null {
  return STORY_TREES[templateId] ?? null;
}

export function hasStoryTree(templateId: string): boolean {
  return templateId in STORY_TREES;
}

/**
 * Structural validation of a tree: every `next` resolves to an existing node,
 * the tree converges to `ending`, no node is unreachable, and the depth is sane.
 * Returns the list of problems (empty = valid).
 */
export function validateTree(tree: StoryTree): string[] {
  const errors: string[] = [];
  const ids = new Set(Object.keys(tree.nodes));

  if (!ids.has(tree.root)) errors.push(`root "${tree.root}" missing`);
  if (!ids.has(tree.ending)) errors.push(`ending "${tree.ending}" missing`);

  // Every option.next resolves; ending has no options.
  for (const node of Object.values(tree.nodes)) {
    if (node.id === tree.ending) {
      if (node.options.length) errors.push(`ending node has ${node.options.length} options`);
      continue;
    }
    if (node.options.length === 0) errors.push(`node "${node.id}" has no options`);
    for (const opt of node.options) {
      if (opt.next === null) continue;
      if (!ids.has(opt.next)) errors.push(`node "${node.id}" option "${opt.id}" → unknown "${opt.next}"`);
    }
  }

  // Reachability from root (BFS).
  const reachable = new Set<string>();
  const queue = [tree.root];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id) || !ids.has(id)) continue;
    reachable.add(id);
    for (const opt of tree.nodes[id]?.options ?? []) {
      if (opt.next) queue.push(opt.next);
    }
  }
  for (const id of ids) {
    if (!reachable.has(id)) errors.push(`node "${id}" unreachable from root`);
  }
  if (!reachable.has(tree.ending)) errors.push(`ending unreachable from root`);

  return errors;
}
