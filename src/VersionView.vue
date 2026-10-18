<script
  setup
  lang="ts"
  generic="D extends object, I, S, O, H, A extends object, E = never"
>
import SubmissionRuntime from "./SubmissionRuntime.vue";
import type { VersionDefinition } from "./version";
import type { ConfigurationBlock } from "./configuration";
defineProps<{
  definition: VersionDefinition<D, I, S, O, H, A, E>;
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
