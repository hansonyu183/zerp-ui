<script setup lang="ts">
import { computed, inject } from "vue";
import BusinessInteractions from "./BusinessInteractions.vue";
import type { Interaction } from "./collaboration";
import PrintPreview from "./PrintPreview.vue";
import type {
  CollectionTarget,
  OutputNode,
  InteractionNode,
} from "./business-model";
import { directRuntimeKey } from "./direct-model-runtime";
const props = defineProps<{
  node: OutputNode | InteractionNode;
  readOnly?: boolean;
}>();
const runtime = inject(directRuntimeKey)!;
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
const interactions = computed<readonly Interaction<CollectionTarget>[]>(
  () =>
    questions.value?.items.flatMap((item): Interaction<CollectionTarget>[] => {
      if (item.kind === "download")
        return runtime.allowed(item.target.collection, "export")
          ? [
              {
                ...item,
                disabled:
                  item.disabled ||
                  runtime.operations(item.target.collection).export?.disabled ||
                  runtime.busy.value.has(item.target.collection),
              },
            ]
          : [];
      if (item.kind === "related") return readable(item.target) ? [item] : [];
      if (item.kind === "menu" || item.kind === "tree")
        return [
          {
            ...item,
            items: item.items
              .filter((entry) => readable(entry.target))
              .map((entry) => ({
                ...entry,
                children: entry.children?.filter((child) =>
                  readable(child.target),
                ),
              })),
          },
        ];
      return [item];
    }) ?? [],
);
function answer(id: string, value: string | boolean) {
  if (!props.readOnly && questions.value && runtime.writable(props.node))
    questions.value.value[id] = value;
}
function visit(target: CollectionTarget) {
  if (!runtime.readable(props.node) || !readable(target)) return;
  const download = questions.value?.items.some(
    (item) =>
      item.kind === "download" && item.target === target && !item.disabled,
  );
  if (download) void runtime.run(target.collection, "export");
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
      :disabled="readOnly || busy || runtime.operations(node).print?.disabled"
      @opened="runtime.run(node, 'print')"
    />
    <p v-else>尚未生成预览</p>
  </section>
</template>
