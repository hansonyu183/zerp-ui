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
import { readableTarget, targetHref, visitTarget } from "./model-target";
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
  return readableTarget(runtime, target);
}

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
          if (!questions.value || !runtime.downloadable(questions.value))
            return [];
          const operation = target.operation;
          const blocked = () =>
            !alive ||
            !questions.value?.items.includes(item) ||
            item.target !== target ||
            target.operation !== operation ||
            !!item.disabled ||
            operation.disabled;
          return [
            {
              ...item,
              disabled: blocked() || busy.value,
              target: { kind: "fileDownload", operation, blocked },
            },
          ];
        }
        return runtime.allowed(target.collection, "export")
          ? [
              {
                ...item,
                target: {
                  kind: "download",
                  target,
                  blocked: () => !!item.disabled,
                },
                disabled:
                  item.disabled ||
                  runtime.operations(target.collection).export?.disabled ||
                  runtime.busy.value.has(target.collection),
              },
            ]
          : [];
      }
      if (item.kind === "related") {
        const source = questions.value;
        const target = item.target;
        return readable(target)
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
      if (item.kind === "menu" || item.kind === "tree")
        return [
          {
            ...item,
            items: item.items.flatMap((entry) => {
              const source = questions.value;
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
  if ("operation" in intent) {
    const node = questions.value;
    if (node)
      void (
        intent.kind === "action" ? runtime.runInteraction : runtime.runDownload
      )(node, intent.operation, () => props.node === node && !intent.blocked());
    return;
  }
  const { target } = intent;
  if (intent.blocked() || !runtime.readable(props.node) || !readable(target))
    return;
  if (intent.kind === "download") void runtime.run(target.collection, "export");
  else {
    visitTarget(runtime, target);
  }
}
</script>
<template>
  <BusinessInteractions
    v-if="questions"
    :items="interactions"
    :href="
      (intent) =>
        intent.kind === 'visit' && runtime.readable(node) && !intent.blocked()
          ? targetHref(runtime, intent.target)
          : undefined
    "
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
