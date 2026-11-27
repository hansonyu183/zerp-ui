<script setup lang="ts">
// 管理工作区公共布局，包括顶部工具栏、响应式导航和反馈容器。
import { computed, nextTick, ref, useId, useTemplateRef, watch } from "vue";
import { useDisplay } from "vuetify";
import {
  VDefaultsProvider,
  VLayout,
  VMain,
  VNavigationDrawer,
  VThemeProvider,
} from "vuetify/components";
import FeedbackHost from "../../components/feedback/FeedbackHost.vue";
import {
  shellDefaults,
  shellThemeName,
  type ThemeChoice,
} from "../../styles/theme";

const props = defineProps<{ theme: ThemeChoice }>();
const { mobile } = useDisplay();
const id = useId();
const navigationId = `zerp-work-navigation-${id}`;
const toggleId = `zerp-work-toggle-${id}`;
const overlayId = `zerp-shell-overlays-${id.replace(/:/g, "-")}`;
const layout = useTemplateRef<InstanceType<typeof VLayout>>("layout");
const barHeight = computed(
  () => layout.value?.getLayoutItem("app-bar")?.size ?? 0,
);
const overlayDefaults = { attach: `#${overlayId}`, contained: true };
const defaults = computed(() => ({
  ...shellDefaults(props.theme),
  VOverlay: overlayDefaults,
  VDialog: overlayDefaults,
  VMenu: overlayDefaults,
  VTooltip: overlayDefaults,
  VSnackbar: overlayDefaults,
}));
const drawer = ref<boolean | null>(null);
const navigationOpen = computed(() => drawer.value ?? !mobile.value);
function toggle() {
  drawer.value = !navigationOpen.value;
}
function closeNavigation() {
  if (mobile.value) drawer.value = false;
}
watch(drawer, async (open, previous) => {
  if (open || !previous || !mobile.value) return;
  const active = document.activeElement;
  if (
    active !== document.body &&
    !document.getElementById(navigationId)?.contains(active)
  )
    return;
  await nextTick();
  document.getElementById(toggleId)?.focus({ preventScroll: true });
});
function escapeNavigation(event: KeyboardEvent) {
  if (
    event.key !== "Escape" ||
    event.defaultPrevented ||
    (event.target instanceof Element && event.target.closest(".v-overlay")) ||
    !mobile.value ||
    !drawer.value
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  drawer.value = false;
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
        <FeedbackHost>
          <slot
            name="toolbar"
            :controls="{ navigationId, toggleId, navigationOpen }"
            :toggle="toggle"
          />
          <VNavigationDrawer
            v-model="drawer"
            :width="224"
            :order="1"
            :retain-focus="mobile"
            :capture-focus="mobile"
          >
            <slot
              name="navigation"
              :id="navigationId"
              :close="closeNavigation"
            />
          </VNavigationDrawer>
          <VMain>
            <div :id="overlayId" class="zerp-shell-overlays" />
            <div class="zerp-shell-content"><slot /></div>
          </VMain>
        </FeedbackHost>
      </VLayout>
    </VDefaultsProvider>
  </VThemeProvider>
</template>
