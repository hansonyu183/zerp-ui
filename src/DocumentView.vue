<script
  setup
  lang="ts"
  generic="D extends object, I, S, O, H, A extends object, E = never"
>
import SubmissionRuntime from "./SubmissionRuntime.vue";
import type { DocumentDefinition } from "./document";
import type { ConfigurationBlock } from "./configuration";
defineProps<{
  definition: DocumentDefinition<D, I, S, O, H, A, E>;
  scope: string;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly ConfigurationBlock<D>[];
}>();
</script>
<template>
  <SubmissionRuntime
    :definition="definition"
    :scope="scope"
    :permissions="permissions"
    :blocks="blocks"
  />
</template>
