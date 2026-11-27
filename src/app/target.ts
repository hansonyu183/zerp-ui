// 判断集合和记录目标是否可用，并为点击时核对目标身份提供依据。
import { ancestors as nodeAncestors, readable as nodeReadable } from "./nodes";
import { toRaw } from "vue";
import { sessionScope } from "./session";
import type { CollectionTarget } from "../model/business-model";
export function readableTarget(target: CollectionTarget) {
  const parents = target.record ? nodeAncestors(target.record) : [];
  return (
    nodeReadable(target.collection) &&
    nodeAncestors(target.collection).length === 0 &&
    (!target.record ||
      (parents.length === 1 &&
        toRaw(parents[0]!) === toRaw(target.collection) &&
        nodeReadable(target.record)))
  );
}
export function availableTarget(target: CollectionTarget) {
  return (
    readableTarget(target) && (!target.record || !!target.record.businessType)
  );
}
const targetIds = new WeakMap<object, number>();
let nextTargetId = 0;
function targetId(object: object) {
  const raw = toRaw(object);
  if (!targetIds.has(raw)) targetIds.set(raw, ++nextTargetId);
  return targetIds.get(raw);
}
// 绑定当前会话、对象引用和记录身份，避免旧按钮打开变化后的目标。
export function targetStamp(target: CollectionTarget): string;
export function targetStamp(
  target: CollectionTarget | undefined,
): string | undefined;
export function targetStamp(target?: CollectionTarget) {
  if (!target) return;
  const { collection, record } = target;
  return JSON.stringify([
    sessionScope.value,
    targetId(collection),
    record && targetId(record),
    record?.identity,
  ]);
}
