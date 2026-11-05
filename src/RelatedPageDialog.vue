<script setup lang="ts">
import { shallowRef } from "vue";
import { VBtn } from "vuetify/components";
import RecordDialog from "./RecordDialog.vue";
import PageContentHost from "./PageContentHost.vue";
import type { AppPageHandle, PageDefinition } from "./pages";
import type { EditProtection } from "./edit-guard";
const props = defineProps<{
  page: PageDefinition;
  scope: string;
  active: boolean;
  discardVersion: number;
}>();
const emit = defineEmits<{ close: []; protection: [value: EditProtection] }>();
const host = shallowRef<AppPageHandle | null>(null);
const blocked = shallowRef(false);
function protect(value: EditProtection) {
  blocked.value = value.writeState !== "idle";
  emit("protection", value);
}
async function close() {
  const page = props.page;
  if ((await host.value?.requestLeave()) && page === props.page && props.active)
    emit("close");
}
</script>
<template>
  <RecordDialog :title="page.title" :blocked="blocked" @close="close">
    <PageContentHost
      ref="host"
      :page="page"
      :scope="scope"
      :active="active"
      :discard="discardVersion"
      :heading="false"
      @protection="protect"
    />
    <VBtn :disabled="blocked" @click="close">关闭</VBtn>
  </RecordDialog>
</template>
