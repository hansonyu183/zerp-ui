<script setup lang="ts">
import { computed, inject } from "vue";
import BusinessInteractions from "./BusinessInteractions.vue";
import type { Interaction } from "./collaboration";
import PrintPreview from "./PrintPreview.vue";
import { nodeMetadata as meta } from "./model-node";
import {
  directRuntimeKey,
  type Node,
  type Target,
} from "./direct-model-runtime";
const props = defineProps<{ node: Node; readOnly?: boolean }>();
const runtime = inject(directRuntimeKey)!;
const questions = computed(
  () => props.node as Extract<Node, { [meta]: { kind: "interactions" } }>,
);
const output = computed(
  () => props.node as Extract<Node, { [meta]: { kind: "output" } }>,
);
const busy = computed(() => runtime.busy.value.has(props.node));
function answer(id: string, value: string | boolean) {
  if (props.readOnly || !runtime.writable(props.node)) return;
  questions.value.value[id] = value;
}
type Intent = { kind: "visit" | "download"; node: Target };
const interactions = computed<readonly Interaction<Intent>[]>(() =>
  questions.value[meta].items.flatMap((item): Interaction<Intent>[] => {
    if (item.kind === "download")
      return runtime.allowed(item.target, "export")
        ? [
            {
              ...item,
              disabled:
                !!runtime.operations(item.target).export?.disabledReason ||
                runtime.busy.value.has(item.target),
              target: { kind: "download", node: item.target },
            },
          ]
        : [];
    if (item.kind === "related")
      return runtime.readable(item.target)
        ? [{ ...item, target: { kind: "visit", node: item.target } }]
        : [];
    if (item.kind === "menu" || item.kind === "tree")
      return [
        {
          ...item,
          items: item.items
            .filter((entry) => runtime.readable(entry.target))
            .map((entry) => ({
              ...entry,
              target: { kind: "visit" as const, node: entry.target },
              children: entry.children
                ?.filter((child) => runtime.readable(child.target))
                .map((child) => ({
                  ...child,
                  target: { kind: "visit" as const, node: child.target },
                })),
            })),
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
  }),
);
function visit(target: Intent) {
  if (!runtime.readable(props.node)) return;
  if (target.kind === "download") void runtime.run(target.node, "export");
  else if (runtime.readable(target.node))
    runtime.model()[meta].navigation.visit(target.node);
}
</script>
<template>
  <BusinessInteractions
    v-if="node[meta].kind === 'interactions'"
    :items="interactions"
    :answers="questions.value"
    :disabled="busy || !runtime.readable(node)"
    :answers-disabled="readOnly || !runtime.writable(node)"
    @answer="answer"
    @intent="visit"
  />
  <section
    v-else-if="node[meta].kind === 'output'"
    :aria-label="node[meta].name"
  >
    <PrintPreview
      v-if="output.value"
      :document="output.value"
      :allowed="
        runtime.allowed(node, 'print') && !!runtime.operations(node).print
      "
      :disabled="
        readOnly || busy || !!runtime.operations(node).print?.disabledReason
      "
      @opened="runtime.run(node, 'print')"
    />
    <p v-else>尚未生成预览</p>
  </section>
</template>
