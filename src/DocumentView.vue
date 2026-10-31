<script
  setup
  lang="ts"
  generic="D extends object, I, S, O, H, A extends object, E = never"
>
import type {EditProtection} from './edit-guard';
import type { DomainBlock } from "./domain-blocks";
import SubmissionRuntime from "./SubmissionRuntime.vue";
import type { DocumentDefinition } from "./document";

const props=defineProps<{
  definition: DocumentDefinition<D, I, S, O, H, A, E>;
  scope: string;
  beforeClose?:()=>Promise<boolean>;
  discardVersion?:number;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly DomainBlock<D>[];
}>();
const emit=defineEmits<{protection:[state:EditProtection]}>();
</script>
<template>
  <SubmissionRuntime
    :definition="definition"
    :scope="scope"
    :permissions="permissions"
    :blocks="blocks"
    :before-close="beforeClose"
    :discard-version="discardVersion"
    @protection="emit('protection',$event)"
  />
</template>
