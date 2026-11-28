<script setup lang="ts">
import { runWithFeedback } from "../../app/feedback";
import { runOperation } from "../../app/node-actions";
import { isPending } from "../../app/usePending";
import {
  available as nodeAvailable,
  formLocked,
  readable as nodeReadable,
  writable as nodeWritable,
} from "../../app/nodes";
import { computed, inject, onBeforeUnmount } from "vue";
import Interactions from "./Interactions.vue";
import type { Interaction } from "../../model/collaboration";
import PrintPreview from "../printing/PrintPreview.vue";
import type {
  CollectionTarget,
  OutputNode,
  InteractionNode,
  InteractionAction,
} from "../../model/business-model";
import { availableTarget, readableTarget } from "../../app/target";
const props = defineProps<{
  node: OutputNode | InteractionNode;
  readOnly?: boolean;
  targetHref?: (target: CollectionTarget) => string | undefined;
}>();
const emit = defineEmits<{ visit: [target: CollectionTarget] }>();
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
const questions = computed(() =>
  props.node.kind === "interactions" ? props.node : null,
);
const output = computed(() =>
  props.node.kind === "output" ? props.node : null,
);
const busy = computed(() => isPending(props.node));
const locked = inject(formLocked, undefined);

type Intent =
  | {
      kind: "visit" | "download";
      target: CollectionTarget;
      blocked(): boolean;
    }
  | {
      kind: "action" | "fileDownload";
      operation: InteractionAction["operation"];
      blocked(): boolean;
    };
type Menu = Extract<
  Interaction<CollectionTarget, InteractionAction>,
  { kind: "menu" | "tree" }
>;
function menuEntry(entry: Menu["items"][number], current: () => boolean) {
  const target = entry.target;
  if ("kind" in target) {
    const operation = target.operation;
    const blocked = () =>
      !alive ||
      !questions.value ||
      !!props.readOnly ||
      !current() ||
      entry.target !== target ||
      target.operation !== operation ||
      !!entry.disabled ||
      operation.disabled ||
      !nodeWritable(questions.value);
    if (blocked()) return null;
    return {
      ...entry,
      disabled: busy.value,
      target: { kind: "action" as const, operation, blocked },
    };
  }
  return !entry.disabled && availableTarget(target)
    ? {
        ...entry,
        target: {
          kind: "visit" as const,
          target,
          blocked: () =>
            !current() || entry.target !== target || !!entry.disabled,
        },
      }
    : null;
}
const interactions = computed<readonly Interaction<Intent>[]>(
  () =>
    questions.value?.items.flatMap((item): Interaction<Intent>[] => {
      if (item.kind === "download") {
        const target = item.target;
        if ("kind" in target) {
          if (!questions.value || !nodeReadable(questions.value)) return [];
          const operation = target.operation;
          const blocked = () =>
            !alive ||
            !questions.value?.items.includes(item) ||
            item.target !== target ||
            target.operation !== operation ||
            !!item.disabled ||
            operation.disabled;
          if (blocked()) return [];
          return [
            {
              ...item,
              disabled: busy.value,
              target: { kind: "fileDownload", operation, blocked },
            },
          ];
        }
        const source = questions.value;
        const blocked = () =>
          !alive ||
          !source?.items.includes(item) ||
          props.node !== source ||
          item.target !== target ||
          !!item.disabled ||
          !readableTarget(target) ||
          !nodeAvailable(target.collection, "export");
        return blocked()
          ? []
          : [
              {
                ...item,
                target: { kind: "download", target, blocked },
                disabled: isPending(target.collection),
              },
            ];
      }
      if (item.kind === "related") {
        const source = questions.value;
        const target = item.target;
        return !item.disabled && availableTarget(target)
          ? [
              {
                ...item,
                target: {
                  kind: "visit",
                  target,
                  blocked: () =>
                    !alive ||
                    !source ||
                    props.node !== source ||
                    !source.items.includes(item) ||
                    item.target !== target ||
                    !!item.disabled,
                },
              },
            ]
          : [];
      }
      if (item.kind === "menu" || item.kind === "tree") {
        const source = questions.value;
        const items = item.items.flatMap((entry) => {
          const current = () =>
            props.node === source &&
            !!source?.items.includes(item) &&
            item.items.includes(entry);
          const mapped = menuEntry(entry, current);
          if (!mapped) return [];
          return [
            {
              ...mapped,
              children: entry.children?.flatMap((child) => {
                const mappedChild = menuEntry(
                  child,
                  () =>
                    current() &&
                    !entry.disabled &&
                    !!entry.children?.includes(child),
                );
                return mappedChild ? [mappedChild] : [];
              }),
            },
          ];
        });
        return items.length ? [{ ...item, items }] : [];
      }
      if (
        item.kind === "message" ||
        item.kind === "confirm" ||
        item.kind === "input" ||
        item.kind === "grid"
      )
        return [item];
      return [];
    }) ?? [],
);
function answer(id: string, value: string | boolean) {
  if (
    !locked?.value &&
    !props.readOnly &&
    questions.value &&
    nodeWritable(props.node)
  )
    questions.value.value[id] = value;
}
function visit(intent: Intent) {
  if (locked?.value) return;
  if ("operation" in intent) {
    const node = questions.value;
    if (node)
      void runWithFeedback(
        node,
        () => intent.operation.run(),
        () =>
          props.node === node &&
          (intent.kind === "action" || nodeReadable(node)) &&
          !intent.blocked(),
        node,
      );
    return;
  }
  const { target } = intent;
  if (intent.blocked() || !nodeReadable(props.node)) return;
  if (intent.kind === "download")
    void runOperation(target.collection, "export");
  else {
    emit("visit", target);
  }
}
</script>
<template>
  <Interactions
    v-if="questions"
    :items="interactions"
    :href="
      (intent) =>
        intent.kind === 'visit' && nodeReadable(node) && !intent.blocked()
          ? targetHref?.(intent.target)
          : undefined
    "
    :answers="questions.value"
    :disabled="locked || busy || !nodeReadable(node)"
    :answers-disabled="readOnly || !nodeWritable(node)"
    @answer="answer"
    @intent="visit"
  />
  <section v-else-if="output" :aria-label="output.label ?? undefined">
    <PrintPreview
      v-if="output.value"
      :document="output.value"
      :action-available="() => nodeAvailable(node, 'print')"
      :disabled="locked || busy"
      @opened="runOperation(node, 'print')"
    />
    <p v-else>尚未生成预览</p>
  </section>
</template>
