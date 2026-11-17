import { modelCollections } from "./model-collections";
import { toRaw } from "vue";
import type { CollectionTarget } from "./business-model";
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
export function targetHref(runtime: DirectRuntime, target: CollectionTarget) {
  return readableTarget(runtime, target)
    ? runtime.model().navigation.href(target.collection, target.record)
    : undefined;
}
export function visitTarget(runtime: DirectRuntime, target: CollectionTarget) {
  if (!readableTarget(runtime, target)) return;
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
