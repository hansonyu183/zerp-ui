import { collectionHref, goToCollection } from "./work-router";
import { openRecord } from "./record-windows";
import {
  ancestors as nodeAncestors,
  readable as nodeReadable,
} from "./business-nodes";
import { toRaw } from "vue";
import { sessionScope } from "./business-session";
import type { CollectionTarget, ObjectNode } from "./business-model";
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
export function canOpenRecord(record: ObjectNode) {
  return !!record.businessType && nodeReadable(record);
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
export function renderedTarget(event: Event) {
  return event.currentTarget instanceof HTMLElement
    ? event.currentTarget.dataset.target
    : undefined;
}
export function targetHref(target: CollectionTarget) {
  return !target.record && availableTarget(target)
    ? collectionHref(target.collection)
    : undefined;
}
export function visitTarget(target: CollectionTarget) {
  if (!availableTarget(target)) return;
  if (target.record) {
    const trigger = document.activeElement;
    openRecord({
      collection: target.collection,
      record: target.record,
      mode: "read",
      focus: () => (trigger instanceof HTMLElement ? trigger : null),
    });
  } else goToCollection(target.collection);
}
export function plainClick(event: MouseEvent | KeyboardEvent) {
  return (
    !event.defaultPrevented &&
    (!(event instanceof MouseEvent) || event.button === 0) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function renderedHref(event: MouseEvent | KeyboardEvent) {
  return event.currentTarget instanceof Element
    ? event.currentTarget.getAttribute("href")
    : null;
}
