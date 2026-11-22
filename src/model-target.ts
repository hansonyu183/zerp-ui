import { modelCollections } from "./model-collections";
import { toRaw } from "vue";
import type { CollectionTarget, ObjectNode } from "./business-model";
import type { DirectRuntime } from "./direct-model-runtime";
export function readableTarget(
  runtime: DirectRuntime,
  target: CollectionTarget,
) {
  const parents = target.record ? runtime.ancestors(target.record) : [];
  return (
    modelCollections(runtime.model()).some(
      (collection) => toRaw(collection) === toRaw(target.collection),
    ) &&
    runtime.readable(target.collection) &&
    (!target.record ||
      (parents.length === 1 &&
        toRaw(parents[0]!) === toRaw(target.collection) &&
        runtime.readable(target.record)))
  );
}
export function canOpenRecord(runtime: DirectRuntime, record: ObjectNode) {
  return (
    runtime.readable(record) &&
    (!runtime.operations(record).get || runtime.available(record, "get"))
  );
}
export function availableTarget(
  runtime: DirectRuntime,
  target: CollectionTarget,
) {
  return (
    readableTarget(runtime, target) &&
    (!target.record || canOpenRecord(runtime, target.record))
  );
}
export function targetHref(runtime: DirectRuntime, target: CollectionTarget) {
  return availableTarget(runtime, target)
    ? runtime.model().navigation.href(target.collection, target.record)
    : undefined;
}
export function visitTarget(runtime: DirectRuntime, target: CollectionTarget) {
  if (!availableTarget(runtime, target)) return;
  if (target.record) target.collection.selected = target.record;
  runtime.model().navigation.visit(target.collection, target.record);
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
