<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  ZerpShell,
  defaultThemeChoice,
  type ThemeChoice,
  type NavigationGroup,
  type AccountIntent,
  type LoadState,
} from "@zerp/ui";
import DirectExample from "../direct/App.vue";
import ConfigurationExample from "../configuration/App.vue";
import ReportExample from "../report/App.vue";
import VersionExample from "../version/App.vue";
import DocumentExample from "../document/App.vue";
import WorkflowExample from "../workflow/App.vue";
const route = useRoute();
const entries = [
  ["direct", "直接维护", DirectExample],
  ["configuration", "配置", ConfigurationExample],
  ["report", "报表", ReportExample],
  ["version", "版本档案", VersionExample],
  ["document", "单据", DocumentExample],
  ["workflow", "流程", WorkflowExample],
] as const;
const current = computed(
  () => entries.find(([key]) => route.path === `/${key}`) ?? entries[5],
);
const navigation: NavigationGroup[] = [
  {
    key: "synthetic",
    caption: "合成公司业务",
    items: entries.map(([key, caption]) => ({
      key,
      caption,
      to: `/${key}`,
      icon: key === "report" ? "report" : "catalog",
    })),
  },
];
const brandState = ref<LoadState>({ kind: "ready" });
const navigationState = ref<LoadState>({ kind: "ready" });
const theme = ref<ThemeChoice>(defaultThemeChoice);
function restore() {
  const value = localStorage.getItem("example-shell-theme");
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (
        ["md1", "md2", "md3"].includes(parsed.preset) &&
        ["light", "dark"].includes(parsed.mode)
      )
        theme.value = parsed;
    } catch {
      /* Invalid consumer preference is discarded. */
    }
  }
}
restore();
function saveTheme(choice: ThemeChoice) {
  theme.value = choice;
  localStorage.setItem("example-shell-theme", JSON.stringify(choice));
}
const signedIn = ref(localStorage.getItem("example-account") !== "signed-out");
const accountFlow = ref<AccountIntent>();
const password = ref("");
const name = ref("演示账户");
function recover() {
  signedIn.value = localStorage.getItem("example-account") !== "signed-out";
  password.value = "";
  accountFlow.value = undefined;
  restore();
}
onMounted(() => {
  window.addEventListener("pageshow", recover);
  window.addEventListener("storage", recover);
});
onUnmounted(() => {
  window.removeEventListener("pageshow", recover);
  window.removeEventListener("storage", recover);
});
function accountAction(action: AccountIntent) {
  if (action === "sign-out") {
    localStorage.setItem("example-account", "signed-out");
    recover();
  } else accountFlow.value = action;
}
function login() {
  localStorage.removeItem("example-account");
  recover();
}
function finishAccount() {
  password.value = "";
  accountFlow.value = undefined;
}
</script>
<template>
  <ZerpShell
    :brand="{
      productName: '星河演示',
      enterpriseName: '合成公司',
      mark: { kind: 'text', text: '星' },
    }"
    :brand-state="brandState"
    :navigation="navigation"
    :navigation-state="navigationState"
    :page-title="current[1]"
    footer="合成数据演示 · 非真实后端"
    :account="
      signedIn
        ? { label: name, actions: ['profile', 'change-password', 'sign-out'] }
        : undefined
    "
    :theme="theme"
    @update:theme="saveTheme"
    @retry-brand="brandState = { kind: 'ready' }"
    @retry-navigation="navigationState = { kind: 'ready' }"
    @account-action="accountAction"
  >
    <p>全部业务 Adapter 为合成数据；账户流程和会话恢复由本示例持有。</p>
    <button @click="brandState = { kind: 'error', caption: '品牌读取失败' }">
      模拟品牌失败</button
    ><button
      @click="navigationState = { kind: 'error', caption: '导航读取失败' }"
    >
      模拟导航失败
    </button>
    <form v-if="!signedIn" @submit.prevent="login">
      <p>合成账户登录（不连接认证服务）</p>
      <label>账户<input v-model="name" required /></label
      ><button>登录演示账户</button>
    </form>
    <form v-else-if="accountFlow" @submit.prevent="finishAccount">
      <label v-if="accountFlow === 'profile'"
        >显示名称<input v-model="name" /></label
      ><label v-else
        >新密码<input v-model="password" type="password" required /></label
      ><button>确认账户修改</button
      ><button type="button" @click="finishAccount">取消账户修改</button>
    </form>
    <component :is="current[2]" v-if="signedIn" :key="current[0]" />
  </ZerpShell>
</template>
