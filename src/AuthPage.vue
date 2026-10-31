<script setup lang="ts">
import { computed } from "vue";
import Feedback from "./Feedback.vue";
import { VThemeProvider, VDefaultsProvider, VBtn } from "vuetify/components";
import {
  defaultThemeChoice,
  shellDefaults,
  shellThemeName,
  type Brand,
  type LoadState,
  type ThemeChoice,
} from "./shell";
import type {
  AuthCapabilities,
  AuthMode,
  AuthSubmit,
  AuthValues,
} from "./auth";

const props = withDefaults(
  defineProps<{
    brand: Brand;
    brandState: LoadState;
    mode: AuthMode;
    values: AuthValues;
    capabilities?: AuthCapabilities;
    busy?: boolean;
    error?: string;
    notice?: string;
    theme?: ThemeChoice;
  }>(),
  { theme: () => defaultThemeChoice },
);
const emit = defineEmits<{
  "update:mode": [mode: AuthMode];
  "update:values": [values: AuthValues];
  submit: [request: AuthSubmit];
  "retry-brand": [];
}>();

const title = computed(
  () =>
    ({
      "sign-in": "登录",
      register: "注册账号",
      recover: "找回密码",
      reset: "设置新密码",
    })[props.mode],
);
const valid = computed(() => {
  const { identifier, password, confirmation } = props.values;
  if (props.mode === "recover") return !!identifier.trim();
  if (props.mode === "reset") return !!password && password === confirmation;
  if (props.mode === "register")
    return !!identifier.trim() && !!password && password === confirmation;
  return !!identifier.trim() && !!password;
});
const confirmationMismatch = computed(
  () =>
    (props.mode === "register" || props.mode === "reset") &&
    !!props.values.confirmation &&
    props.values.password !== props.values.confirmation,
);

function set(field: keyof AuthValues, event: Event) {
  emit("update:values", {
    ...props.values,
    [field]: (event.target as HTMLInputElement).value,
  });
}
function switchMode(mode: AuthMode) {
  if (props.busy || mode === props.mode) return;
  emit("update:values", {
    identifier: mode === "reset" ? "" : props.values.identifier,
    password: "",
    confirmation: "",
  });
  emit("update:mode", mode);
}
function submit() {
  if (props.busy || !valid.value) return;
  const identifier = props.values.identifier.trim();
  const password = props.values.password;
  const request: AuthSubmit =
    props.mode === "sign-in"
      ? { mode: "sign-in", identifier, password }
      : props.mode === "register"
        ? { mode: "register", identifier, password }
        : props.mode === "recover"
          ? { mode: "recover", identifier }
          : { mode: "reset", password };
  emit("submit", request);
}
</script>

<template>
  <VThemeProvider
    :theme="shellThemeName(theme)"
    with-background
    class="zerp-auth-page"
  >
    <VDefaultsProvider :defaults="shellDefaults(theme)">
      <main class="zerp-auth-card">
        <header class="zerp-auth-brand">
          <span v-if="brand.mark.kind === 'text'" class="zerp-auth-mark">{{
            brand.mark.text
          }}</span>
          <img v-else :src="brand.mark.src" :alt="brand.mark.alt" />
          <h1>{{ brand.productName }}</h1>
          <div class="zerp-auth-brand-state">
            <p v-if="brandState.kind === 'ready'">{{ brand.enterpriseName }}</p>
            <p v-else-if="brandState.kind === 'loading'" role="status">
              品牌加载中
            </p>
            <p v-else role="alert">
              {{ brandState.caption }}
              <VBtn type="button" @click="emit('retry-brand')">重试品牌</VBtn>
            </p>
          </div>
        </header>
        <h2>{{ title }}</h2>
        <div class="zerp-feedback-region">
          <Feedback :message="error" kind="error" />
          <Feedback :message="notice" />
        </div>
        <form @submit.prevent="submit">
          <label v-if="mode !== 'reset'">
            账号
            <input
              :value="values.identifier"
              autocomplete="username"
              :disabled="busy"
              required
              @input="set('identifier', $event)"
            />
          </label>
          <label v-if="mode !== 'recover'">
            {{ mode === "reset" ? "新密码" : "密码" }}
            <input
              :value="values.password"
              type="password"
              :autocomplete="
                mode === 'sign-in' ? 'current-password' : 'new-password'
              "
              :disabled="busy"
              required
              @input="set('password', $event)"
            />
          </label>
          <label v-if="mode === 'register' || mode === 'reset'">
            确认密码
            <input
              :value="values.confirmation"
              type="password"
              autocomplete="new-password"
              :disabled="busy"
              required
              @input="set('confirmation', $event)"
            />
          </label>
          <Feedback
            :message="confirmationMismatch ? '两次输入的密码不一致' : undefined"
            kind="error"
          />
          <VBtn
            type="submit"
            color="primary"
            :loading="busy"
            :disabled="busy || !valid"
          >
            {{ title }}
          </VBtn>
        </form>
        <nav aria-label="认证操作">
          <VBtn
            v-if="mode === 'sign-in' && capabilities?.register"
            type="button"
            variant="text"
            :disabled="busy"
            @click="switchMode('register')"
            >注册账号</VBtn
          >
          <VBtn
            v-if="mode === 'sign-in' && capabilities?.recover"
            type="button"
            variant="text"
            :disabled="busy"
            @click="switchMode('recover')"
            >忘记密码</VBtn
          >
          <VBtn
            v-if="mode !== 'sign-in'"
            type="button"
            variant="text"
            :disabled="busy"
            @click="switchMode('sign-in')"
            >返回登录</VBtn
          >
        </nav>
      </main>
    </VDefaultsProvider>
  </VThemeProvider>
</template>
