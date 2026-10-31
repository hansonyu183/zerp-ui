<script setup lang="ts">
import PageContentHost from './PageContentHost.vue';
import type {PageDefinition,AppPageHandle} from './pages';
import type {EditProtection} from './edit-guard';
import { computed, nextTick, ref, useId, useTemplateRef, watch } from "vue";
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
  VAvatar,
} from "vuetify/components";
import "./shell-layout.css";
import Feedback from "./Feedback.vue";
import {
  defaultThemeChoice,
  shellDefaults,
  shellThemeName,
  navigationGlyph,
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
    selectedNavigationKey?: string | null;
    page: PageDefinition;
    scope: string;
    active?: boolean;
    footer: string;
    account?: ShellAccount;
    theme?: ThemeChoice;
  }>(),
  { theme: () => defaultThemeChoice, active:true },
);
const emit = defineEmits<{
  protection:[value:EditProtection];
  "retry-brand": [];
  "retry-navigation": [];
  "account-action": [AccountIntent];
  "update:theme": [ThemeChoice];
}>();
const pageContent=useTemplateRef<AppPageHandle>('pageContent');
defineExpose<AppPageHandle>({requestLeave:()=>pageContent.value?.requestLeave()??Promise.resolve(false)});
const { mobile, xs } = useDisplay();
const navigationId = useId();
const overlayId = `zerp-shell-overlays-${useId().replace(/:/g, "-")}`;
const layout = useTemplateRef<InstanceType<typeof VLayout>>("layout");
const barHeight = computed(
  () => layout.value?.getLayoutItem("app-bar")?.size ?? 0,
);
const overlayDefaults = computed(() => ({
  attach: `#${overlayId}`,
  contained: true,
}));
const navigationToggle =
  useTemplateRef<InstanceType<typeof VBtn>>("navigationToggle");
const navigationElement = useTemplateRef<HTMLElement>("navigationElement");
const drawer = ref<boolean | null>(null);
const defaults = computed(() => ({
  ...shellDefaults(props.theme),
  VOverlay: overlayDefaults.value,
  VDialog: overlayDefaults.value,
  VMenu: overlayDefaults.value,
  VTooltip: overlayDefaults.value,
  VSnackbar: overlayDefaults.value,
}));
const selectedItem = computed(() =>
  props.navigation
    .flatMap((group) => group.items)
    .find((item) => item.key === props.selectedNavigationKey),
);
const labels: Record<AccountIntent, string> = {
  profile: "名称与头像",
  "change-password": "更改密码",
  "sign-out": "退出登录",
};
const accountActions: readonly AccountIntent[] = [
  "profile",
  "change-password",
  "sign-out",
];
const presets = ["md1", "md2", "md3"] as const;
function preset(value: ThemeChoice["preset"]) {
  emit("update:theme", { ...props.theme, preset: value });
}
watch(drawer, async (open, previous) => {
  if (open || !previous || !mobile.value) return;
  const active = document.activeElement;
  if (active !== document.body && !navigationElement.value?.contains(active))
    return;
  await nextTick();
  navigationToggle.value?.$el.focus({ preventScroll: true });
});
function escapeNavigation(event: KeyboardEvent) {
  if (
    event.key !== "Escape" ||
    event.defaultPrevented ||
    (event.target instanceof Element && !!event.target.closest(".v-overlay")) ||
    !mobile.value ||
    !drawer.value
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  drawer.value = false;
}
function navigated(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
    return;
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
      <VLayout
        ref="layout"
        :style="{ '--zerp-app-bar-height': `${barHeight}px` }"
        @keydown="escapeNavigation"
      >
        <VAppBar name="app-bar" :order="0" :height="xs ? 56 : 64">
          <div class="zerp-shell-toolbar">
            <VBtn
              ref="navigationToggle"
              :aria-controls="navigationId"
              :aria-expanded="drawer ?? !mobile"
              aria-label="切换导航"
              title="切换导航"
              icon
              size="small"
              @click="drawer = !(drawer ?? !mobile)"
              >☰</VBtn
            >
            <RouterLink
              :to="brand.home"
              class="zerp-shell-brand"
              :aria-label="`${brand.productName}：首页`"
            >
              <VAvatar color="primary" :size="xs ? 28 : 36">
                <span v-if="brand.mark.kind === 'text'">{{
                  brand.mark.text
                }}</span>
                <img v-else :src="brand.mark.src" :alt="brand.mark.alt" />
              </VAvatar>
              <span class="zerp-shell-brand-copy">
                <strong :title="brand.productName">{{
                  brand.productName
                }}</strong>
                <span
                  v-if="brandState.kind === 'ready'"
                  class="zerp-shell-enterprise"
                  >{{ brand.enterpriseName }}</span
                >
              </span>
            </RouterLink>
            <Feedback
              class="zerp-shell-brand-status"
              :kind="brandState.kind === 'error' ? 'error' : 'status'"
              :message="
                brandState.kind === 'loading'
                  ? '品牌加载中'
                  : brandState.kind === 'error'
                    ? brandState.caption
                    : undefined
              "
              ><VBtn
                v-if="brandState.kind === 'error'"
                @click="emit('retry-brand')"
                >重试品牌</VBtn
              ></Feedback
            >
            <div class="zerp-shell-actions">
              <VMenu location="bottom end" content-class="zerp-shell-overlay">
                <template #activator="{ props: activator }"
                  ><VBtn
                    v-bind="activator"
                    icon
                    size="small"
                    aria-label="主题预设"
                    title="主题预设"
                    ><span class="zerp-ui-icon" aria-hidden="true"
                      >&#xF050E;</span
                    ></VBtn
                  ></template
                >
                <div class="zerp-shell-menu" role="menu" aria-label="主题预设">
                  <VBtn
                    v-for="(choice, index) in presets"
                    :key="choice"
                    role="menuitemradio"
                    :aria-checked="theme.preset === choice"
                    :aria-label="`Material Design ${index + 1}`"
                    @click="preset(choice)"
                    >Material Design {{ index + 1 }}</VBtn
                  >
                </div>
              </VMenu>
              <VBtn
                aria-label="切换明暗模式"
                title="切换明暗模式"
                icon
                size="small"
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
                v-if="account"
                location="bottom end"
                content-class="zerp-shell-overlay"
              >
                <template #activator="{ props: activator }"
                  ><VBtn
                    v-bind="activator"
                    :aria-label="`账户：${account.label}`"
                    :title="account.label"
                    class="zerp-shell-account-button"
                    size="small"
                    ><VAvatar color="primary" :size="xs ? 28 : 34"
                      ><img
                        v-if="account.avatar"
                        :src="account.avatar.src"
                        :alt="account.avatar.alt"
                      /><span v-else aria-hidden="true">{{
                        account.label.trim().slice(0, 1) || "U"
                      }}</span></VAvatar
                    ><span class="zerp-shell-account-label">{{
                      account.label
                    }}</span></VBtn
                  ></template
                >
                <div class="zerp-shell-account" role="menu">
                  <VBtn
                    v-for="action in accountActions"
                    :key="action"
                    role="menuitem"
                    @click="emit('account-action', action)"
                    >{{ labels[action] }}</VBtn
                  >
                </div>
              </VMenu>
            </div>
          </div>
        </VAppBar>
        <VNavigationDrawer
          v-model="drawer"
          :order="1"
          :retain-focus="mobile"
          :capture-focus="mobile"
        >
          <nav :id="navigationId" ref="navigationElement" aria-label="主导航">
            <Feedback
              :kind="navigationState.kind === 'error' ? 'error' : 'status'"
              :message="
                navigationState.kind === 'loading'
                  ? '导航加载中'
                  : navigationState.kind === 'error'
                    ? navigationState.caption
                    : undefined
              "
              ><VBtn
                v-if="navigationState.kind === 'error'"
                @click="emit('retry-navigation')"
                >重试导航</VBtn
              ></Feedback
            >
            <template v-if="navigationState.kind === 'ready'">
              <component
                :is="group.ungrouped ? 'div' : 'details'"
                v-for="group in navigation"
                :key="group.key"
                :open="group.ungrouped ? undefined : true"
              >
                <summary v-if="!group.ungrouped">{{ group.caption }}</summary>
                <RouterLink
                  v-for="item in group.items"
                  :key="item.key"
                  :to="item.to"
                  custom
                  v-slot="{ href, navigate, isActive, isExactActive }"
                >
                  <a
                    :href="href"
                    :class="{
                      'router-link-active':
                        selectedNavigationKey === undefined
                          ? isActive
                          : selectedItem === item,
                      'router-link-exact-active':
                        selectedNavigationKey === undefined
                          ? isExactActive
                          : selectedItem === item,
                    }"
                    :aria-current="
                      (
                        selectedNavigationKey === undefined
                          ? isExactActive
                          : selectedItem === item
                      )
                        ? 'page'
                        : undefined
                    "
                    @click="
                      navigated($event);
                      navigate($event);
                    "
                    ><span
                      v-if="item.icon"
                      aria-hidden="true"
                      class="zerp-ui-icon"
                      >{{ navigationGlyph(item.icon) }}</span
                    >{{ item.caption }}</a
                  >
                </RouterLink>
              </component>
            </template>
          </nav>
        </VNavigationDrawer>
        <VMain
          ><div :id="overlayId" class="zerp-shell-overlays" />
          <div class="zerp-shell-content">
            <PageContentHost ref="pageContent" :page="page" :scope="scope" :active="active" @protection="emit('protection',$event)" />
            <footer>{{ footer }}</footer>
          </div></VMain
        >
      </VLayout>
    </VDefaultsProvider>
  </VThemeProvider>
</template>
