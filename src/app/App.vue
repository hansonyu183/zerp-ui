<script setup lang="ts">
// 接收消费者的响应式模型，按会话状态切换登录页和工作页，并连接主题与阻断反馈。
import { computed, ref, useTemplateRef } from "vue";
import type { BusinessModel } from "../model/business-model";
import { useApp } from "./useApp";
import { useVuetify } from "./useVuetify";
import { defaultThemeChoice, type ThemeChoice } from "../styles/theme";
import SignInPage from "./sign-in/SignInPage.vue";
import WorkPage from "./work/WorkPage.vue";

const props = defineProps<{ model: BusinessModel }>();
const { ready, blocking } = useApp(() => props.model);
useVuetify(() => props.model.brand);
const workPage = useTemplateRef("workPage");
function openUrl(url: string): boolean {
  return workPage.value?.openUrl(url) ?? false;
}
defineExpose({ openUrl });

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
        ref="workPage"
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
