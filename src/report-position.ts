import { toRaw } from "vue";
import type { ListCollection } from "./business-model";
import { readable } from "./business-nodes";

const positions = new Map<ListCollection, { left: number; top: number }>();

export function reportPosition(node: ListCollection) {
  return positions.get(toRaw(node));
}

export function saveReportPosition(
  node: ListCollection,
  position: { left: number; top: number },
) {
  positions.set(toRaw(node), position);
}

export function clearReportPositions(reset: boolean) {
  if (reset) positions.clear();
  else
    for (const node of positions.keys())
      if (!readable(node)) positions.delete(node);
}
