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
} from "vuetify/components";
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
const navigationToggle =
  useTemplateRef<InstanceType<typeof VBtn>>("navigationToggle");
const navigationElement = useTemplateRef<HTMLElement>("navigationElement");
const drawer = ref<boolean | null>(null);
const defaults = computed(() => shellDefaults(props.theme));
const selectedItem = computed(() =>
  props.navigation
    .flatMap((group) => group.items)
    .find((item) => item.key === props.selectedNavigationKey),
);
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
      <VLayout @keydown="escapeNavigation">
        <VAppBar :height="xs ? 112 : undefined">
          <div
            class="zerp-shell-toolbar"
            :class="{ 'zerp-shell-toolbar--narrow': xs }"
          >
            <VBtn
              ref="navigationToggle"
              :aria-controls="navigationId"
              :aria-expanded="drawer ?? !mobile"
              aria-label="切换导航"
              title="切换导航"
              @click="drawer = !(drawer ?? !mobile)"
              >☰</VBtn
            >
            <div class="zerp-shell-brand">
              <span v-if="brand.mark.kind === 'text'">{{
                brand.mark.text
              }}</span>
              <img v-else :src="brand.mark.src" :alt="brand.mark.alt" />
              <strong :title="brand.productName">{{
                brand.productName
              }}</strong>
              <span
                v-if="brandState.kind === 'ready'"
                class="zerp-shell-enterprise"
                >{{ brand.enterpriseName }}</span
              >
              <span v-else-if="brandState.kind === 'loading'" role="status"
                >品牌加载中</span
              >
              <span v-else role="alert"
                >{{ brandState.caption }}
                <VBtn @click="emit('retry-brand')">重试品牌</VBtn></span
              >
            </div>
            <div class="zerp-shell-actions">
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
                    :title="account.label"
                    >{{ xs ? "账户" : account.label }}</VBtn
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
            </div>
          </div>
        </VAppBar>
        <VNavigationDrawer
          v-model="drawer"
          :retain-focus="mobile"
          :capture-focus="mobile"
        >
          <nav :id="navigationId" ref="navigationElement" aria-label="主导航">
            <p v-if="navigationState.kind === 'loading'" role="status">
              导航加载中
            </p>
            <div v-else-if="navigationState.kind === 'error'" role="alert">
              {{ navigationState.caption
              }}<VBtn @click="emit('retry-navigation')">重试导航</VBtn>
            </div>
            <template v-else>
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
          ><div class="zerp-shell-content">
            <PageContentHost ref="pageContent" :page="page" :scope="scope" :active="active" @protection="emit('protection',$event)" />
            <footer>{{ footer }}</footer>
          </div></VMain
        >
      </VLayout>
    </VDefaultsProvider>
  </VThemeProvider>
</template>
