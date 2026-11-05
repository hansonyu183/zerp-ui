<script setup lang="ts">
import { ref, watch } from "vue";
import { VMenu, VBtn, VCard, VCardText } from "vuetify/components";
const props = defineProps<{
  id: string;
  label: string;
  messages: readonly string[];
  focused?: boolean;
}>();
const open = ref(false);
watch([() => props.focused, () => props.messages.join("；")], () => {
  if (!props.messages.length) open.value = false;
  else if (props.focused) open.value = true;
});
</script>
<template>
  <span :id="id" class="zerp-sr-only" aria-live="polite">{{
    messages.join("；")
  }}</span>
  <VMenu
    v-if="messages.length"
    v-model="open"
    open-on-hover
    open-on-focus
    :open-on-click="true"
    :close-on-content-click="false"
    location="bottom end"
    :max-width="360"
  >
    <template #activator="{ props: activator }">
      <VBtn
        v-bind="activator"
        class="zerp-field-error"
        type="button"
        size="small"
        variant="text"
        color="error"
        icon="mdi-alert-circle-outline"
        :aria-label="`${label}错误详情`"
      />
    </template>
    <VCard
      class="zerp-field-error-content"
      role="note"
      :aria-label="`${label}错误详情`"
    >
      <VCardText>{{ messages.join("；") }}</VCardText>
      <VBtn type="button" variant="text" @click="open = false">关闭</VBtn>
    </VCard>
  </VMenu>
</template>
