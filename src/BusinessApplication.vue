<script setup lang="ts">
import { computed, ref } from "vue";
import type { BusinessModel } from "./business-model";
import { useBusinessApplication } from "./useBusinessApplication";
import { defaultThemeChoice, type ThemeChoice } from "./shell";
import SignInPage from "./SignInPage.vue";
import WorkPage from "./WorkPage.vue";

const props = defineProps<{ model: BusinessModel }>();
const { ready, blocking } = useBusinessApplication(() => props.model);
const localTheme = ref(defaultThemeChoice);
const theme = computed(() => props.model.theme?.value ?? localTheme.value);
function changeTheme(value: ThemeChoice) {
  if (props.model.theme) props.model.theme.change(value);
  else localTheme.value = value;
}
</script>

<template>
  <div>
    <div :inert.attr="blocking ? true : undefined">
      <WorkPage
        v-if="ready"
        :model="model.work"
        :brand="model.brand"
        :theme="theme"
        @update:theme="changeTheme"
      />
      <SignInPage
        v-else
        :model="model.authentication"
        :brand="model.brand"
        :theme="theme"
      />
    </div>
  </div>
</template>
