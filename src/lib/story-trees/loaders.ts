// Client-safe dynamic loaders for the story trees.
//
// Client components (StepAdventure) must NOT import from "./index": that file statically imports all
// 10 trees (~600KB source) for the server-side story generator. The client
// loads only the selected template's tree as its own chunk via these loaders.

import type { StoryTree } from "./types";

export { tx } from "./types";

const LOADERS: Record<string, () => Promise<StoryTree>> = {
  space: () => import("./space").then((m) => m.spaceTree),
  forest: () => import("./forest").then((m) => m.forestTree),
  dinosaurs: () => import("./dinosaurs").then((m) => m.dinosaursTree),
  pirates: () => import("./pirates").then((m) => m.piratesTree),
  superhero: () => import("./superhero").then((m) => m.superheroTree),
  chef: () => import("./chef").then((m) => m.chefTree),
  castle: () => import("./castle").then((m) => m.castleTree),
  safari: () => import("./safari").then((m) => m.safariTree),
  inventor: () => import("./inventor").then((m) => m.inventorTree),
  candy: () => import("./candy").then((m) => m.candyTree),
};

/** Whether a template has a branching tree (no tree data loaded). */
export function templateHasTree(templateId: string): boolean {
  return templateId in LOADERS;
}

/** Load a template's tree as its own client chunk. null if it has none. */
export function loadStoryTree(templateId: string): Promise<StoryTree> | null {
  return LOADERS[templateId]?.() ?? null;
}
