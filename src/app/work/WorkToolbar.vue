<script setup lang="ts">
// 呈现品牌首页链接、主题选择和账户操作，将操作意图交给 WorkPage。
import { ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  VAppBar,
  VAvatar,
  VBtn,
  VList,
  VListItem,
  VMenu,
} from "vuetify/components";
import { plainClick } from "../target";
import { appBarHeight, type Brand, type ThemeChoice } from "../../styles/theme";
import type { AccountIntent } from "./navigation";

const props = defineProps<{
  brand: Brand;
  scope: string;
  accountLabel: string;
  accountActions: readonly AccountIntent[];
  theme: ThemeChoice;
  navigationId: string;
  navigationOpen: boolean;
  toggleId: string;
}>();
const emit = defineEmits<{
  home: [];
  toggle: [];
  "update:theme": [ThemeChoice];
  "account-action": [AccountIntent];
}>();
function home(event: MouseEvent) {
  if (!plainClick(event)) return;
  event.preventDefault();
  emit("home");
}
const themeMenu = ref(false);
const accountMenu = ref(false);
watch(
  [() => props.scope, () => props.accountLabel],
  () => {
    themeMenu.value = false;
    accountMenu.value = false;
  },
  { flush: "sync" },
);
const labels: Record<AccountIntent, string> = {
  profile: "名称与头像",
  "change-password": "更改密码",
  "sign-out": "退出登录",
};
const presets = ["md1", "md2", "md3"] as const;
function preset(value: ThemeChoice["preset"]) {
  emit("update:theme", { ...props.theme, preset: value });
}
</script>

<template>
  <VAppBar name="app-bar" :order="0" :height="appBarHeight">
    <div class="zerp-shell-toolbar">
      <VBtn
        :id="toggleId"
        :aria-controls="navigationId"
        :aria-expanded="navigationOpen"
        aria-label="切换导航"
        icon
        size="default"
        @click="emit('toggle')"
        >☰</VBtn
      >
      <RouterLink to="/" custom v-slot="{ href }">
        <a
          :href="href"
          class="zerp-shell-brand"
          :aria-label="`${brand.productName}：首页`"
          @click="home"
        >
          <VAvatar color="primary" :size="28">
            <span>{{ brand.mark }}</span>
          </VAvatar>
          <span class="zerp-shell-brand-copy">
            <strong :title="brand.productName">{{ brand.productName }}</strong>
            <span v-if="brand.enterpriseName" class="zerp-shell-enterprise">{{
              brand.enterpriseName
            }}</span>
          </span>
        </a>
      </RouterLink>
      <div class="zerp-shell-actions">
        <VMenu
          v-model="themeMenu"
          location="bottom end"
          content-class="zerp-shell-overlay"
        >
          <template #activator="{ props: activator }"
            ><VBtn
              v-bind="activator"
              icon
              size="default"
              aria-label="主题预设"
              title="主题预设"
              ><span class="zerp-ui-icon" aria-hidden="true"
                >&#xF050E;</span
              ></VBtn
            ></template
          >
          <VList class="zerp-shell-menu" role="menu" aria-label="主题预设">
            <VListItem
              v-for="(choice, index) in presets"
              :key="choice"
              role="menuitemradio"
              :aria-checked="theme.preset === choice"
              :aria-label="`Material Design ${index + 1}`"
              @click="preset(choice)"
              :title="`Material Design ${index + 1}`"
              :active="theme.preset === choice"
            />
          </VList>
        </VMenu>
        <VBtn
          aria-label="切换明暗模式"
          title="切换明暗模式"
          icon
          size="default"
          @click="
            emit('update:theme', {
              ...theme,
              mode: theme.mode === 'light' ? 'dark' : 'light',
            })
          "
          ><span class="zerp-ui-icon" aria-hidden="true">{{
            theme.mode === "light" ? "\u{F0594}" : "\u{F0599}"
          }}</span></VBtn
        >
        <VMenu
          v-model="accountMenu"
          location="bottom end"
          content-class="zerp-shell-overlay"
        >
          <template #activator="{ props: activator }"
            ><VBtn
              v-bind="activator"
              :aria-label="`账户：${accountLabel}`"
              :title="accountLabel"
              class="zerp-shell-account-button"
              size="default"
              ><VAvatar color="primary" :size="28"
                ><span aria-hidden="true">{{
                  accountLabel.trim().slice(0, 1) || "U"
                }}</span></VAvatar
              ><span class="zerp-shell-account-label">{{
                accountLabel
              }}</span></VBtn
            ></template
          >
          <VList class="zerp-shell-account" role="menu" aria-label="账户菜单">
            <VListItem
              v-for="action in accountActions"
              :key="action"
              role="menuitem"
              @click="emit('account-action', action)"
              :title="labels[action]"
            />
          </VList>
        </VMenu>
      </div>
    </div>
  </VAppBar>
</template>
