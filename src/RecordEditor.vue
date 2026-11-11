<script setup lang="ts">
import RecordDialog from "./RecordDialog.vue";
import { useDisplay } from "vuetify";
import FeedbackHost from "./FeedbackHost.vue";
defineProps<{
  title: string;
  blocked?: boolean;
  returnFocus?: HTMLElement | null;
  inline?: boolean;
}>();
const { xs } = useDisplay();
const emit = defineEmits<{
  close: [];
  feedback: [element: HTMLElement | null];
}>();
</script>
<template>
  <RecordDialog
    v-if="!inline || xs"
    :title="title"
    :blocked="blocked"
    :return-focus="returnFocus"
    @close="emit('close')"
    @feedback="emit('feedback', $event)"
    ><slot
  /></RecordDialog>
  <section v-else :aria-label="title" class="zerp-related-editor">
    <FeedbackHost @target="emit('feedback', $event)"
      ><h3>{{ title }}</h3>
      <slot
    /></FeedbackHost>
  </section>
</template>
