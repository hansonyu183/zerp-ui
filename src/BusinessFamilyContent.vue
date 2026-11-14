<script setup lang="ts">
import { computed, inject } from "vue";
import BusinessInteractions from "./BusinessInteractions.vue";
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
function visit(target: Target) {
  if (runtime.readable(target)) runtime.model()[meta].navigation.visit(target);
}
</script>
<template>
  <BusinessInteractions
    v-if="node[meta].kind === 'interactions'"
    :items="questions[meta].items"
    :answers="questions.value"
    :disabled="readOnly || !runtime.writable(node)"
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
