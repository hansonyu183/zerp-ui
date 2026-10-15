<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { useDisplay } from "vuetify";
import {
  VThemeProvider,
  VDefaultsProvider,
  VLayout,
  VAppBar,
  VMain,
  VNavigationDrawer,
  VMenu,
  VBtn,
} from "vuetify/components";
import {
  defaultThemeChoice,
  shellDefaults,
  shellThemeName,
  navigationIcons,
  type Brand,
  type LoadState,
  type NavigationGroup,
  type ShellAccount,
  type AccountIntent,
  type ThemeChoice,
} from "./shell";
const props = withDefaults(
  defineProps<{
    brand: Brand;
    brandState: LoadState;
    navigation: readonly NavigationGroup[];
    navigationState: LoadState;
    pageTitle: string;
    footer: string;
    account?: ShellAccount;
    theme?: ThemeChoice;
  }>(),
  { theme: () => defaultThemeChoice },
);
const emit = defineEmits<{
  "retry-brand": [];
  "retry-navigation": [];
  "account-action": [AccountIntent];
  "update:theme": [ThemeChoice];
}>();
const { mobile } = useDisplay();
const drawer = ref<boolean | null>(null);
const defaults = computed(() => shellDefaults(props.theme));
const labels: Record<AccountIntent, string> = {
  profile: "个人资料",
  "change-password": "修改密码",
  "sign-out": "退出登录",
};
function preset(event: Event) {
  emit("update:theme", {
    ...props.theme,
    preset: (event.target as HTMLSelectElement).value as ThemeChoice["preset"],
  });
}
function navigated() {
  if (mobile.value) drawer.value = false;
}
</script>
<template>
  <VThemeProvider
    :theme="shellThemeName(theme)"
    with-background
    class="zerp-shell"
  >
    <VDefaultsProvider :defaults="defaults">
      <VLayout>
        <VAppBar>
          <VBtn
            aria-label="切换导航"
            title="切换导航"
            @click="drawer = !(drawer ?? !mobile)"
            >☰</VBtn
          >
          <div class="zerp-shell-brand">
            <span v-if="brand.mark.kind === 'text'">{{ brand.mark.text }}</span>
            <img v-else :src="brand.mark.src" :alt="brand.mark.alt" />
            <strong>{{ brand.productName }}</strong>
            <span v-if="brandState.kind === 'ready'">{{
              brand.enterpriseName
            }}</span>
            <span v-else-if="brandState.kind === 'loading'" role="status"
              >品牌加载中</span
            >
            <span v-else role="alert"
              >{{ brandState.caption }}
              <VBtn @click="emit('retry-brand')">重试品牌</VBtn></span
            >
          </div>
          <label class="zerp-shell-theme"
            >主题预设<select
              :value="theme.preset"
              aria-label="主题预设"
              @change="preset"
            >
              <option value="md1">Material Design 1</option>
              <option value="md2">Material Design 2</option>
              <option value="md3">Material Design 3</option>
            </select></label
          >
          <VBtn
            aria-label="切换明暗模式"
            title="切换明暗模式"
            @click="
              emit('update:theme', {
                ...theme,
                mode: theme.mode === 'light' ? 'dark' : 'light',
              })
            "
            >{{ theme.mode === "light" ? "深色" : "浅色" }}</VBtn
          >
          <VMenu v-if="account" content-class="zerp-shell-overlay">
            <template #activator="{ props: activator }"
              ><VBtn
                v-bind="activator"
                :aria-label="`账户：${account.label}`"
                >{{ account.label }}</VBtn
              ></template
            >
            <div class="zerp-shell-account" role="menu">
              <VBtn
                v-for="action in account.actions"
                :key="action"
                role="menuitem"
                @click="emit('account-action', action)"
                >{{ labels[action] }}</VBtn
              >
            </div>
          </VMenu>
        </VAppBar>
        <VNavigationDrawer v-model="drawer">
          <nav aria-label="主导航">
            <p v-if="navigationState.kind === 'loading'" role="status">
              导航加载中
            </p>
            <div v-else-if="navigationState.kind === 'error'" role="alert">
              {{ navigationState.caption
              }}<VBtn @click="emit('retry-navigation')">重试导航</VBtn>
            </div>
            <template v-else>
              <details v-for="group in navigation" :key="group.key" open>
                <summary>{{ group.caption }}</summary>
                <RouterLink
                  v-for="item in group.items"
                  :key="item.key"
                  :to="item.to"
                  @click="navigated"
                  ><span
                    v-if="item.icon"
                    aria-hidden="true"
                    class="zerp-ui-icon"
                    >{{ navigationIcons[item.icon] }}</span
                  >{{ item.caption }}</RouterLink
                >
              </details>
            </template>
          </nav>
        </VNavigationDrawer>
        <VMain
          ><div class="zerp-shell-content">
            <h1>{{ pageTitle }}</h1>
            <slot />
            <footer>{{ footer }}</footer>
          </div></VMain
        >
      </VLayout>
    </VDefaultsProvider>
  </VThemeProvider>
</template>
