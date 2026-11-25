<script setup lang="ts">
defineOptions({ inheritAttrs: false });
defineSlots<{}>();
import PageContentHost from "../../src/PageContentHost.vue";
import type { PageDefinition, AppPageHandle } from "../../src/pages";
import type { EditProtection } from "../../src/edit-guard";
import { useTemplateRef } from "vue";
import ApplicationShell from "../../src/ApplicationShell.vue";
import { VBtn, VList, VListItem, VMenu } from "vuetify/components";
import Feedback from "../../src/Feedback.vue";
import FeedbackRegion from "../../src/FeedbackRegion.vue";
import {
  defaultThemeChoice,
  type Brand,
  type LoadState,
  type NavigationGroup,
  type PageNavigationGroup,
  type ShellAccount,
  type AccountIntent,
  type ThemeChoice,
} from "../../src/shell";
withDefaults(
  defineProps<{
    brand: Brand;
    brandState: LoadState;
    navigation: readonly NavigationGroup[];
    navigationState: LoadState;
    selectedNavigationKey?: string | null;
    visit?: (key: string) => void;
    pageNavigation?: readonly PageNavigationGroup[];
    page: PageDefinition;
    scope: string;
    active?: boolean;
    footer: string;
    account?: ShellAccount;
    accountActions?: readonly AccountIntent[];
    theme?: ThemeChoice;
  }>(),
  { theme: () => defaultThemeChoice, active: true },
);
const emit = defineEmits<{
  protection: [value: EditProtection];
  "retry-brand": [];
  "retry-navigation": [];
  "account-action": [AccountIntent];
  "update:theme": [ThemeChoice];
}>();
const pageContent = useTemplateRef<AppPageHandle>("pageContent");
defineExpose<AppPageHandle>({
  requestLeave: () =>
    pageContent.value?.requestLeave() ?? Promise.resolve(false),
});
</script>
<template>
  <ApplicationShell
    :brand="
      brandState.kind === 'ready' ? brand : { ...brand, enterpriseName: '' }
    "
    :navigation="navigationState.kind === 'ready' ? navigation : []"
    :selected-navigation-key="selectedNavigationKey"
    :visit="visit"
    :scope="scope"
    :active="active"
    :account="account"
    :account-actions="accountActions"
    :theme="theme"
    @account-action="emit('account-action', $event)"
    @update:theme="emit('update:theme', $event)"
  >
    <template #brand-status>
      <FeedbackRegion
        ><Feedback
          :kind="brandState.kind === 'error' ? 'error' : 'status'"
          :message="
            brandState.kind === 'loading'
              ? '品牌加载中'
              : brandState.kind === 'error'
                ? brandState.caption
                : undefined
          "
          ><VBtn v-if="brandState.kind === 'error'" @click="emit('retry-brand')"
            >重试品牌</VBtn
          ></Feedback
        ></FeedbackRegion
      >
    </template>
    <template #navigation-status>
      <FeedbackRegion
        ><Feedback
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
        ></FeedbackRegion
      >
    </template>
    <nav
      v-if="active && pageNavigation?.some((group) => group.items.length)"
      aria-label="页面导航"
      class="zerp-page-navigation"
    >
      <template v-for="group in pageNavigation" :key="group.key">
        <div
          v-if="group.kind === 'tabs' && group.items.length"
          :aria-label="group.caption"
          class="zerp-page-navigation__tabs"
        >
          <VBtn
            v-for="item in group.items"
            :key="item.key"
            :to="item.to"
            :active="group.selectedKey === item.key"
            :aria-current="group.selectedKey === item.key ? 'page' : undefined"
            variant="text"
            >{{ item.caption }}</VBtn
          >
        </div>
        <VMenu v-else-if="group.items.length">
          <template #activator="{ props: menuProps }"
            ><VBtn
              v-bind="menuProps"
              variant="text"
              append-icon="mdi-chevron-down"
              >{{ group.caption }}</VBtn
            ></template
          >
          <VList
            ><VListItem
              v-for="item in group.items"
              :key="item.key"
              :to="item.to"
              :title="item.caption"
          /></VList>
        </VMenu>
      </template>
    </nav>
    <PageContentHost
      ref="pageContent"
      :page="page"
      :scope="scope"
      :active="active"
      @protection="emit('protection', $event)"
    />
    <footer v-if="footer">{{ footer }}</footer>
  </ApplicationShell>
</template>

<style scoped>
.zerp-page-navigation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}
.zerp-page-navigation__tabs {
  display: flex;
  max-width: 100%;
  overflow-x: auto;
}
.zerp-page-navigation__tabs .v-btn {
  flex-shrink: 0;
}
</style>
