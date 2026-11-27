<script setup lang="ts">
import type { BusinessModel } from "./business-model";
import { modelBrand, type ThemeChoice } from "./shell";
import AuthFrame from "./AuthFrame.vue";
import BusinessNode from "./BusinessNode.vue";
import BusinessFeedback from "./BusinessFeedback.vue";

defineProps<{
  model: BusinessModel["authentication"];
  brand: BusinessModel["brand"];
  theme: ThemeChoice;
}>();
</script>

<template>
  <AuthFrame :brand="modelBrand(brand)" :theme="theme">
    <BusinessNode
      v-if="model.form.readable !== false"
      :node="model.form"
      public-auth
    />
    <BusinessFeedback />
  </AuthFrame>
</template>
