<script setup lang="ts">
// 固定登录表单的字段位置，认证模型提供字段值、候选项和登录操作。
import { computed } from "vue";
import {
  VBtn,
  VCard,
  VDefaultsProvider,
  VThemeProvider,
} from "vuetify/components";
import type { BusinessModel, FieldNode } from "../../model/business-model";
import {
  modelBrand,
  shellDefaults,
  shellThemeName,
  type ThemeChoice,
} from "../../styles/theme";
import Field from "../../components/forms/Field.vue";
import FeedbackHost from "../../components/feedback/FeedbackHost.vue";
import ModelFeedback from "../../components/feedback/ModelFeedback.vue";
import { available } from "../nodes";
import { isPending, runOperation } from "../operations";
import { sessionScope } from "../session";

const props = defineProps<{
  model: BusinessModel["authentication"];
  brand: BusinessModel["brand"];
  theme: ThemeChoice;
}>();

const displayBrand = computed(() => modelBrand(props.brand));
const fields = computed(() => {
  const members = props.model.form.members;
  return [
    members.find(
      (node): node is FieldNode => node.kind === "reference" && !node.multiple,
    ),
    members.find((node): node is FieldNode => node.kind === "text"),
    members.find((node): node is FieldNode => node.kind === "password"),
  ].filter((node): node is FieldNode => !!node && node.readable !== false);
});
const canSignIn = computed(() => available(props.model.form, "signIn", true));
const pending = computed(() => isPending(props.model.form));

function signIn() {
  void runOperation(props.model.form, "signIn", true);
}
</script>

<template>
  <VThemeProvider
    :theme="shellThemeName(theme)"
    with-background
    class="zerp-auth-page"
  >
    <VDefaultsProvider :defaults="shellDefaults(theme)">
      <FeedbackHost>
        <VCard tag="main" variant="flat" class="zerp-auth-card">
          <header class="zerp-auth-brand">
            <span class="zerp-auth-mark">{{ displayBrand.mark }}</span>
            <h1>{{ displayBrand.productName }}</h1>
            <p v-if="displayBrand.enterpriseName">
              {{ displayBrand.enterpriseName }}
            </p>
          </header>
          <form
            v-if="model.form.readable !== false"
            class="zerp-sign-in-form"
            novalidate
            :aria-label="model.form.label ?? undefined"
            :aria-busy="pending"
            @submit.prevent="signIn"
          >
            <Field
              v-for="field in fields"
              :key="field.key"
              :node="field"
              :scope="sessionScope"
              :read-only="model.form.readOnly"
              public-auth
            />
            <VBtn
              v-if="canSignIn"
              block
              color="primary"
              variant="flat"
              type="submit"
              :disabled="pending"
              >登录</VBtn
            >
          </form>
          <ModelFeedback />
        </VCard>
      </FeedbackHost>
    </VDefaultsProvider>
  </VThemeProvider>
</template>

<style scoped>
.zerp-sign-in-form {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
</style>
