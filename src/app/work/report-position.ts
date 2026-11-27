// 按集合对象保存报表滚动位置，用于下钻返回时恢复。
import { toRaw } from "vue";
import type { ListCollection } from "../../model/business-model";
import { readable } from "../nodes";

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
