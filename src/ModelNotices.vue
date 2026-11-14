<script setup lang="ts">
import { inject } from "vue";
import { VBtn } from "vuetify/components";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
import { modelNoticesKey } from "./model-notices";
const notices = inject(modelNoticesKey, undefined);
</script>
<template>
  <FeedbackRegion v-if="notices" aria-label="模型消息">
    <Feedback
      v-for="item in notices.items.value"
      :key="item.id"
      :message="item.text"
      :kind="item.kind"
      :persistent="item.persistent"
    >
      <VBtn
        v-if="item.target || item.recover"
        variant="text"
        @click="
          item.recover
            ? item.recover()
            : item.target && notices.visit(item.target, item.identity)
        "
        >{{ item.action ?? "查看" }}</VBtn
      >
    </Feedback>
  </FeedbackRegion>
</template>
