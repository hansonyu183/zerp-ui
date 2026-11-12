<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, provide, nextTick } from "vue";
import { useRoute } from "vue-router";
import {
  applicationNavigation,
  defineAccountPage,
  defineDetailsPage,
  AuthPage,
  defaultThemeChoice,
  type AuthMode,
  type AuthSubmit,
  type AuthValues,
  type ThemeChoice,
  type NavigationGroup,
  type AccountIntent,
  type LoadState,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import { createExampleShell, exampleShellKey } from "../shared/shell";
import DirectExample from "../direct/App.vue";
import ConfigurationExample from "../configuration/App.vue";
import ReportExample from "../report/App.vue";
import DocumentExample from "../document/App.vue";
import VoucherExample from "../voucher/App.vue";
import WorkflowExample from "../workflow/App.vue";
const route = useRoute();
const entries = [
  ["direct", "直接维护", DirectExample],
  ["configuration", "配置", ConfigurationExample],
  ["report", "报表", ReportExample],
  ["document", "资料档案", DocumentExample],
  ["voucher", "单据", VoucherExample],
  ["workflow", "流程", WorkflowExample],
] as const;
const current = computed(
  () => entries.find(([key]) => route.path === `/${key}`) ?? entries[5],
);
const application = {
  kind: "object" as const,
  name: "演示应用",
  properties: Object.fromEntries(
    entries.map(([id, name]) => [
      id,
      {
        kind: "object" as const,
        name,
        target: id,
      },
    ]),
  ),
  navigation: {
    groups: [
      {
        id: "synthetic",
        name: "合成公司业务",
        modules: entries.map(([id]) => id),
      },
    ],
  },
};
const navigation: NavigationGroup[] = [
  ...applicationNavigation(
    application,
    Object.fromEntries(
      entries.map(([id]) => [
        id,
        {
          to: `/${id}`,
          icon: id === "report" ? ("report" as const) : ("catalog" as const),
        },
      ]),
    ),
  ),
  {
    key: "query-catalogs",
    caption: "同路径资料",
    items: [
      {
        key: "direct-one",
        caption: "资料一",
        to: "/direct?kind=one",
        icon: "catalog",
      },
      {
        key: "direct-two",
        caption: "资料二",
        to: "/direct?kind=two",
        icon: "catalog",
      },
    ],
  },
  {
    key: "explicit-vouchers",
    caption: "编码分组单据",
    items: [
      { key: "search", caption: "单据查询", to: "/direct?type=all" },
      ...Array.from({ length: 13 }, (_, index) => ({
        key: `purchase-${index}`,
        caption: `A${index} 合成采购${index}`,
        to: `/direct?type=A${index}`,
        section: { key: "A", caption: "采购" },
      })),
      {
        key: "sale",
        caption: "BB 合成销售",
        to: "/direct?type=BB",
        section: { key: "B", caption: "销售" },
      },
    ],
  },
  {
    key: "long-menu",
    caption: "多项导航",
    items: [
      "客户",
      "客户分类",
      "客户联系人",
      "产品",
      "产品分类",
      "供应商",
      "供应商分类",
      "AA 采购订单",
      "AB 采购入库单",
      "国家",
      "币种",
      "部门",
      "仓库",
    ].map((caption, index) => ({
      key: `synthetic-menu-${index}`,
      caption,
      to: `/direct?menu=${index}`,
    })),
  },
];
const selectedNavigationKey = computed(() =>
  route.path === "/direct" && ["one", "two"].includes(String(route.query.kind))
    ? `direct-${route.query.kind}`
    : current.value[0],
);
const brand = {
  productName: "星河演示",
  home: "/",
  enterpriseName: "合成公司",
  mark: { kind: "text" as const, text: "星" },
};
const brandState = ref<LoadState>({ kind: "ready" });
const navigationState = ref<LoadState>({ kind: "ready" });
const theme = ref<ThemeChoice>(defaultThemeChoice);
function restoreTheme() {
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
restoreTheme();
function saveTheme(choice: ThemeChoice) {
  theme.value = choice;
  localStorage.setItem("example-shell-theme", JSON.stringify(choice));
}
const signedIn = ref(localStorage.getItem("example-account") !== "signed-out");
const authMode = ref<AuthMode>("sign-in");
const authValues = ref<AuthValues>({
  identifier: "",
  password: "",
  confirmation: "",
});
const authNotice = ref("");
const name = ref("演示账户");
function recover() {
  signedIn.value = localStorage.getItem("example-account") !== "signed-out";
  authValues.value = { identifier: "", password: "", confirmation: "" };
  authMode.value = "sign-in";
  authNotice.value = "";
  restoreTheme();
}
onMounted(() => {
  window.addEventListener("pageshow", recover);
  window.addEventListener("storage", recover);
});
onUnmounted(() => {
  window.removeEventListener("pageshow", recover);
  window.removeEventListener("storage", recover);
});
const profileValues = ref({ name: "演示账户", avatar: "" });
const passwordValues = ref({ password: "" });
const accountRevision = ref(0);
const profilePage = defineAccountPage(() => ({
  kind: "profile",
  instance: accountRevision.value,
  title: "名称与头像",
  values: profileValues.value,
  fields: [
    { key: "name", label: "显示名称", type: "text", required: true },
    { key: "avatar", label: "头像地址", type: "text" },
  ],
  submitLabel: "确认账户修改",
  cancelLabel: "取消账户修改",
  onChange: (value: typeof profileValues.value) =>
    (profileValues.value = value),
  submit: async (value: typeof profileValues.value) => {
    name.value = value.name;
    shell.name.value = value.name;
    shell.avatar.value = value.avatar
      ? { src: value.avatar, alt: "合成账户头像" }
      : undefined;
    accountRevision.value++;
    await nextTick();
    shell.override.value = undefined;
  },
  onCancel: async () => {
    await nextTick();
    shell.override.value = undefined;
  },
}));
const passwordPage = defineAccountPage(() => ({
  kind: "change-password",
  instance: accountRevision.value,
  title: "更改密码",
  values: passwordValues.value,
  fields: [
    { key: "password", label: "新密码", type: "password", required: true },
  ],
  submitLabel: "确认账户修改",
  cancelLabel: "取消账户修改",
  onChange: (value: typeof passwordValues.value) =>
    (passwordValues.value = value),
  submit: async () => {
    accountRevision.value++;
    passwordValues.value = { password: "" };
    await nextTick();
    shell.override.value = undefined;
  },
  onCancel: async () => {
    await nextTick();
    shell.override.value = undefined;
  },
}));
function accountAction(action: AccountIntent) {
  if (action === "sign-out") {
    localStorage.setItem("example-account", "signed-out");
    recover();
    shell.override.value = undefined;
  } else {
    profileValues.value = { ...profileValues.value, name: name.value };
    shell.override.value = action === "profile" ? profilePage : passwordPage;
  }
}
function authAction(request: AuthSubmit) {
  authValues.value = {
    identifier:
      request.mode === "reset"
        ? ""
        : "identifier" in request
          ? request.identifier
          : "",
    password: "",
    confirmation: "",
  };
  if (request.mode === "sign-in") {
    localStorage.removeItem("example-account");
    recover();
  } else if (request.mode === "recover") {
    authNotice.value = "合成验证已完成，请设置新密码";
    authMode.value = "reset";
  } else {
    authNotice.value =
      request.mode === "register"
        ? "合成注册已完成，请登录"
        : "合成密码重设已完成，请登录";
    authMode.value = "sign-in";
  }
}
const shell = createExampleShell();
shell.hosted = true;
const placeholder = defineDetailsPage({
  title: "正在准备合成页面",
  instance: "loading",
  value: {},
  groups: [],
});
shell.brand = brand;
shell.brandState = brandState;
shell.navigation = navigation;
shell.navigationState = navigationState;
shell.theme = theme;
shell.name = name;
shell.accountAction = accountAction;
shell.saveTheme = saveTheme;
provide(exampleShellKey, shell);
// The Router selects pages; the library receives the selected current key.
import { watchEffect } from "vue";
watchEffect(
  () => (shell.selectedNavigationKey.value = selectedNavigationKey.value),
);
</script>
<template>
  <AuthPage
    v-if="!signedIn"
    :brand="brand"
    :brand-state="brandState"
    :capabilities="{ register: true, recover: true }"
    :mode="authMode"
    :values="authValues"
    :notice="authNotice"
    :theme="theme"
    @update:mode="authMode = $event"
    @update:values="authValues = $event"
    @submit="authAction"
    @retry-brand="brandState = { kind: 'ready' }"
  />
  <template v-else>
    <ExamplePage :page="placeholder" shell-host />
    <component :is="current[2]" :key="current[0]" />
    <aside class="example-controls" aria-label="合成外壳控制">
      <p>全部业务 Adapter 为合成数据；账户流程和会话恢复由本示例持有。</p>
      <button
        @click="
          brandState = {
            kind: 'error',
            caption: '品牌读取失败。'.repeat(100) + '长提示末尾',
          }
        "
      >
        模拟品牌失败</button
      ><button
        @click="navigationState = { kind: 'error', caption: '导航读取失败' }"
      >
        模拟导航失败
      </button>
    </aside>
  </template>
</template>
