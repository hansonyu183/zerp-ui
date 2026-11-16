<script setup lang="ts">
import { computed, inject, onBeforeUnmount } from "vue";
import BusinessInteractions from "./BusinessInteractions.vue";
import type { Interaction } from "./collaboration";
import PrintPreview from "./PrintPreview.vue";
import type {
  CollectionTarget,
  OutputNode,
  InteractionNode,
  InteractionAction,
} from "./business-model";
import { directRuntimeKey } from "./direct-model-runtime";
const props = defineProps<{
  node: OutputNode | InteractionNode;
  readOnly?: boolean;
}>();
const runtime = inject(directRuntimeKey)!;
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
const busy = computed(() => runtime.busy.value.has(props.node));
function readable(target: CollectionTarget) {
  return (
    runtime.readable(target.collection) &&
    (!target.record ||
      (target.collection.items.includes(target.record) &&
        runtime.readable(target.record)))
  );
}
type Intent =
  | {
      kind: "visit" | "download";
      target: CollectionTarget;
      blocked(): boolean;
    }
  | {
      kind: "action";
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
    if (!questions.value || !runtime.interactionVisible(questions.value))
      return null;
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
      !runtime.interactable(questions.value);
    return {
      ...entry,
      disabled: blocked() || busy.value,
      target: { kind: "action" as const, operation, blocked },
    };
  }
  return readable(target)
    ? {
        ...entry,
        target: {
          kind: "visit" as const,
          target,
          blocked: () => !current() || !!entry.disabled,
        },
      }
    : null;
}
const interactions = computed<readonly Interaction<Intent>[]>(
  () =>
    questions.value?.items.flatMap((item): Interaction<Intent>[] => {
      if (item.kind === "download")
        return runtime.allowed(item.target.collection, "export")
          ? [
              {
                ...item,
                target: {
                  kind: "download",
                  target: item.target,
                  blocked: () => !!item.disabled,
                },
                disabled:
                  item.disabled ||
                  runtime.operations(item.target.collection).export?.disabled ||
                  runtime.busy.value.has(item.target.collection),
              },
            ]
          : [];
      if (item.kind === "related")
        return readable(item.target)
          ? [
              {
                ...item,
                target: {
                  kind: "visit",
                  target: item.target,
                  blocked: () => !!item.disabled,
                },
              },
            ]
          : [];
      if (item.kind === "menu" || item.kind === "tree")
        return [
          {
            ...item,
            items: item.items.flatMap((entry) => {
              const current = () =>
                !!questions.value?.items.includes(item) &&
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
            }),
          },
        ];
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
  if (!props.readOnly && questions.value && runtime.writable(props.node))
    questions.value.value[id] = value;
}
function visit(intent: Intent) {
  if (intent.kind === "action") {
    const node = questions.value;
    if (node)
      void runtime.runInteraction(
        node,
        intent.operation,
        () => props.node === node && !intent.blocked(),
      );
    return;
  }
  const { target } = intent;
  if (intent.blocked() || !runtime.readable(props.node) || !readable(target))
    return;
  if (intent.kind === "download") void runtime.run(target.collection, "export");
  else {
    if (target.record) target.collection.selected = target.record;
    runtime.model().navigation.visit(target.collection);
  }
}
</script>
<template>
  <BusinessInteractions
    v-if="questions"
    :items="interactions"
    :answers="questions.value"
    :disabled="busy || !runtime.readable(node)"
    :answers-disabled="readOnly || !runtime.writable(node)"
    @answer="answer"
    @intent="visit"
  />
  <section v-else-if="output" :aria-label="output.label ?? undefined">
    <PrintPreview
      v-if="output.value"
      :document="output.value"
      :allowed="runtime.allowed(node, 'print')"
      :disabled="busy || runtime.operations(node).print?.disabled"
      @opened="runtime.run(node, 'print')"
    />
    <p v-else>尚未生成预览</p>
  </section>
</template>
