import { reactive, watch, toRaw } from "vue";
import { router } from "./router";
import {
  application,
  object,
  collection,
  text,
  secret,
  decimal,
  boolean,
  integer,
  array,
  reference,
  messages,
  type ModelOwner,
  type ModelNode,
  type ModelNavigation,
  type ModelApplicationOptions,
  type ModelRequest,
  type ModelContext,
  type ModelWriteResult,
} from "@zerp/ui/model";
import type { WriteJournal, Attempt } from "@zerp/ui";

type CustomerIdentity = { id: string };
type CustomerInput = {
  name: string | null;
  enabled: boolean | null;
  creditLimit: string | null;
  contact: { phone: string | null };
  units: { label: string | null; quantity: number | null }[];
  category: string | null;
  "external.code": string | null;
};
type ContactInput = { name: string | null; phone: string | null };
const owner = (): ModelOwner => ({
  ledger: "synthetic",
  operator: "synthetic-user",
  generation: crypto.randomUUID(),
});
const storageKey = "zerp-model-demo-";
const options = reactive<ModelApplicationOptions>({
  owner: JSON.parse(
    sessionStorage.getItem(storageKey + "session") ?? "null",
  ) as ModelOwner | null,
  brand: {
    productName: "单一模型",
    enterpriseName: "合成企业",
    home: "/customers",
    mark: { kind: "text", text: "例" },
  },
  account: { label: "演示账户" },
  theme: {
    value: { preset: "md3", mode: "light" },
    change(value) {
      options.theme!.value = value;
    },
  },
  navigation: {} as ModelNavigation,
});
const notifications = reactive(messages());
const records = reactive(
  new Map<string, CustomerInput>(
    JSON.parse(localStorage.getItem(storageKey + "records") ?? "null") ?? [
      [
        "a",
        {
          name: "合成客户",
          enabled: false,
          creditLimit: "12345678901234567890.00",
          contact: { phone: "10000" },
          units: [{ label: "箱", quantity: 0 }],
          category: "historical",
          "external.code": "SYN-A",
        },
      ],
    ],
  ),
);
watch(
  records,
  () =>
    localStorage.setItem(storageKey + "records", JSON.stringify([...records])),
  { deep: true },
);
const contacts = reactive(
  new Map<string, ContactInput>([
    ["c", { name: "合成联系人", phone: "20000" }],
  ]),
);
let revision = 1;
const scenario = reactive(
  (JSON.parse(localStorage.getItem(storageKey + "scenario") ?? "null") as {
    unknown: boolean;
    confirmed: boolean;
    withdrawn: boolean;
    writes: number;
  } | null) ?? {
    unknown: false,
    confirmed: false,
    withdrawn: false,
    writes: 0,
  },
);
watch(
  scenario,
  () => localStorage.setItem(storageKey + "scenario", JSON.stringify(scenario)),
  { deep: true },
);
// Scenario controls are business nodes in the same tree; the consumer supplies no UI.
const controls = object(
  "合成场景",
  {
    unknown: boolean("模拟未知结果", { value: scenario.unknown }),
    confirmed: boolean("确认原请求已应用", { value: scenario.confirmed }),
    withdrawn: boolean("撤销客户编辑权限", { value: scenario.withdrawn }),
  },
  {
    identity: [],
    operations: {
      update: {
        async run(request) {
          scenario.unknown = request.input.unknown === true;
          scenario.confirmed = request.input.confirmed === true;
          scenario.withdrawn = request.input.withdrawn === true;
          notifications.items = [
            {
              id: "scenario",
              level: "warning",
              text: "合成业务资格已更新",
              target: customers,
            },
          ];
          controls.unknown.value = scenario.unknown;
          controls.confirmed.value = scenario.confirmed;
          controls.withdrawn.value = scenario.withdrawn;
          return { status: "success" };
        },
      },
    },
  },
);
function contactNode(id = "", value: ContactInput = { name: "", phone: "" }) {
  return object(
    "联系人",
    {
      id: text("联系人编号", { readOnly: true, value: id }),
      name: text("联系人姓名", { required: true, value: value.name }),
      phone: text("联系人电话", { value: value.phone }),
    },
    {
      identity: ["id"],
      concurrency: String(revision),
      operations: {
        update: {
          async run(
            request: ModelRequest<
              ContactInput,
              CustomerIdentity,
              readonly [CustomerIdentity]
            >,
          ) {
            if (!request.ancestors[0].id) throw Error("缺少客户身份。");
            contacts.set(request.identity.id!, { ...request.input });
            revision++;
            return { status: "success" };
          },
        },
        delete: {
          async run(request) {
            contacts.delete(request.identity.id!);
            return { status: "success" };
          },
        },
      },
    },
  );
}
const customerFacts = reactive({ disabledReason: "" });
watch(
  () => scenario.withdrawn,
  (value) => {
    customerFacts.disabledReason = value ? "当前业务资格已撤销" : "";
  },
  { immediate: true },
);
function customerNode(
  id = "",
  value: CustomerInput = {
    name: "",
    enabled: true,
    creditLimit: "0.00",
    contact: { phone: "" },
    units: [],
    category: null,
    "external.code": "",
  },
) {
  const row = object(
    "客户",
    {
      id: text("客户编号", { readOnly: true, value: id }),
      name: text("客户名称", { required: true, value: value.name }),
      enabled: boolean("启用状态", { value: value.enabled }),
      creditLimit: decimal("信用额度", { value: value.creditLimit }),
      "external.code": text("外部编号", { value: value["external.code"] }),
      category: reference("客户分类", {
        value: value.category,
        operations: {
          search: {
            async run() {
              return { items: [{ id: "active", label: "可选分类" }], total: 1 };
            },
          },
          resolve: {
            async run({ input }) {
              return input.ids.map((id) => ({
                id,
                label: id === "historical" ? "历史停用分类" : "可选分类",
                selectable: id !== "historical",
              }));
            },
          },
        },
      }),
      contact: object("联系信息", {
        phone: text("客户电话", { value: value.contact.phone }),
      }),
      units: array(
        "包装",
        () =>
          object("包装行", {
            label: text("包装名称"),
            quantity: integer("包装数量"),
          }),
        value.units.map((unit) =>
          object("包装行", {
            label: text("包装名称", { value: unit.label }),
            quantity: integer("包装数量", { value: unit.quantity }),
          }),
        ),
      ),
      contacts: collection("独立联系人", () => contactNode(), {
        operations: {
          query: {
            async run() {
              return {
                items: [...contacts].map(([id, value]) =>
                  contactNode(id, value),
                ),
                total: contacts.size,
              };
            },
          },
          create: {
            async run(request) {
              const contactId = crypto.randomUUID();
              contacts.set(contactId, { ...request.input });
              return {
                status: "success",
                snapshot: {
                  value: { id: contactId, ...request.input },
                  identity: { id: contactId },
                  concurrency: String(++revision),
                },
              };
            },
          },
        },
      }),
      settings: object(
        "所属只读设置",
        { settlement: text("结算条件", { value: "月结" }) },
        {
          identity: [],
          operations: {
            get: {
              async run(
                _context: ModelContext<{}, readonly [CustomerIdentity]> & {
                  input: void;
                  page: number;
                  pageSize: number;
                },
              ) {
                return {
                  value: { settlement: "月结" },
                  identity: {},
                  concurrency: "1",
                };
              },
            },
          },
        },
      ),
    },
    {
      identity: ["id"],
      concurrency: String(revision),
      list: ["id", "name", "creditLimit", "enabled"],
      operations: {
        get: {
          async run({ identity }) {
            const value = records.get(identity.id);
            if (!value) throw Error("客户不存在。");
            return {
              value: { id: identity.id, ...value },
              identity,
              concurrency: String(revision),
            };
          },
        },
        update: {
          get disabledReason() {
            return customerFacts.disabledReason;
          },
          async run(
            request,
          ): Promise<
            ModelWriteResult<
              CustomerInput & { id: string | null },
              CustomerIdentity,
              CustomerInput
            >
          > {
            if (request.input.name === "合成字段错误")
              return {
                status: "failure",
                message: "合成业务校验失败",
                fields: [{ field: "name" as const, message: "请修改合成名称" }],
              };
            scenario.writes++;
            records.set(request.identity.id!, request.input as CustomerInput);
            revision++;
            return { status: scenario.unknown ? "unknown" : "success" };
          },
          async reconcile(request) {
            return scenario.confirmed
              ? {
                  status: "applied",
                  requestId: request.requestId,
                  evidence: {
                    value: { id, ...records.get(id)! },
                    identity: request.identity,
                    concurrency: String(revision),
                  },
                  snapshot: {
                    value: { id, ...records.get(id)! },
                    identity: request.identity,
                    concurrency: String(revision),
                  },
                }
              : { status: "unknown" };
          },
        },
        delete: {
          async run({ identity }) {
            records.delete(identity.id!);
            return { status: "success" };
          },
        },
        enable: {
          async run({ identity }) {
            records.get(identity.id!)!.enabled = true;
            return { status: "success" };
          },
        },
        disable: {
          async run({ identity }) {
            records.get(identity.id!)!.enabled = false;
            return { status: "success" };
          },
        },
      },
    },
  );
  return row;
}
const queryInput = object("查询条件", { search: text("客户搜索") });
const customers = collection("客户", customerNode, {
  operations: {
    query: {
      input: queryInput,
      async run({ input, page, pageSize }) {
        const rows = [...records].filter(([, value]) =>
          value.name?.includes(input.search ?? ""),
        );
        return {
          items: rows
            .slice((page - 1) * pageSize, page * pageSize)
            .map(([id, value]) => customerNode(id, value)),
          total: rows.length,
        };
      },
    },
    create: {
      async run(request) {
        const id = crypto.randomUUID();
        records.set(id, request.input as CustomerInput);
        return {
          status: "success",
          snapshot: {
            value: { id, ...request.input },
            identity: { id },
            concurrency: String(++revision),
          },
        };
      },
    },
  },
});
const configuration = object(
  "配置与工作台偏好",
  {
    compact: boolean("紧凑显示", { value: false }),
    favorites: text("工作台常用项", { value: "客户" }),
  },
  {
    identity: [],
    operations: {
      update: {
        async run({ input }) {
          configuration.compact.value = input.compact;
          configuration.favorites.value = input.favorites;
          return { status: "success" };
        },
      },
    },
  },
);
const login = object(
  "登录",
  {
    ledger: reference("账套", {
      operations: {
        search: {
          async run() {
            return {
              items: [{ id: "synthetic", label: "合成账套" }],
              total: 1,
            };
          },
        },
        resolve: {
          async run({ input }) {
            return input.ids.map((id) => ({ id, label: "合成账套" }));
          },
        },
      },
    }),
    identifier: text("操作员", { required: true }),
    password: secret("密码", { required: true }),
  },
  {
    operations: {
      signIn: {
        async run({ input }) {
          if (!input.ledger || !input.identifier || !input.password)
            return {
              status: "failure",
              message: "请选择账套并输入操作员、密码。",
            };
          options.owner = owner();
          sessionStorage.setItem(
            storageKey + "session",
            JSON.stringify(options.owner),
          );
          return { status: "success" };
        },
      },
    },
  },
);
const session = object(
  "当前会话",
  {},
  {
    operations: {
      restoreSession: {
        async run() {
          if (sessionStorage.getItem(storageKey + "session"))
            options.owner = JSON.parse(
              sessionStorage.getItem(storageKey + "session")!,
            );
          return { status: "success" };
        },
      },
      signOut: {
        async run() {
          options.owner = null;
          sessionStorage.removeItem(storageKey + "session");
          return { status: "success" };
        },
      },
    },
  },
);
const password = object(
  "更改密码",
  {
    current: secret("当前密码", { required: true }),
    next: secret("新密码", { required: true }),
    confirmation: secret("确认密码", { required: true }),
  },
  {
    operations: {
      changePassword: {
        async run({ input }) {
          if (!input.next || input.next !== input.confirmation)
            return { status: "failure", message: "请确认新密码。" };
          options.forcePasswordChange = false;
          return { status: "success" };
        },
      },
    },
  },
);
const profile = object(
  "名称与头像",
  { name: text("账户名称", { value: "演示账户" }) },
  {
    identity: [],
    operations: {
      update: {
        async run({ input }) {
          options.account!.label = input.name ?? "";
          return { status: "success" };
        },
      },
    },
  },
);
options.account!.profile = profile;
const favoriteState = reactive(
  new Map<string, boolean>(
    JSON.parse(localStorage.getItem(storageKey + "favorites") ?? "null") ?? [
      ["customers", true],
      ["configuration", false],
    ],
  ),
);
watch(
  favoriteState,
  () =>
    localStorage.setItem(
      storageKey + "favorites",
      JSON.stringify([...favoriteState]),
    ),
  { deep: true },
);
function shortcutNode(id: string, title: string, target: ModelNode) {
  return object(
    "工作台入口",
    {
      id: text("入口编号", { readOnly: true, value: id }),
      name: text("入口名称", { readOnly: true, value: title }),
      destination: reference("入口", {
        readOnly: true,
        value: id,
        target,
        operations: {
          search: {
            async run() {
              return { items: [{ id, label: title }], total: 1 };
            },
          },
          resolve: {
            async run({ input }) {
              return input.ids.map((id) => ({ id, label: title }));
            },
          },
        },
      }),
      added: boolean("加入工作台", { value: favoriteState.get(id) ?? false }),
    },
    {
      identity: ["id"],
      operations: {
        update: {
          async run(request) {
            favoriteState.set(
              request.identity.id!,
              request.input.added === true,
            );
            return { status: "success" };
          },
        },
      },
    },
  );
}
const workbench = collection(
  "工作台与偏好",
  () => shortcutNode("customers", "客户", customers),
  {
    operations: {
      query: {
        input: object("工作台查询", { search: text("工作台搜索") }),
        async run({ input }) {
          const rows = [
            shortcutNode("customers", "客户", customers),
            shortcutNode("configuration", "配置", configuration),
          ].filter((row) => row.name.value?.includes(input.search ?? ""));
          return { items: rows, total: rows.length };
        },
      },
    },
  },
);
const routeNodes: [string, ModelNode][] = [
  ["customers", customers],
  ["workbench", workbench],
  ["configuration", configuration],
  ["scenario", controls],
  ["profile", profile],
  ["password", password],
];
options.navigation = {
  current: null,
  href(node, identity) {
    const path =
      "/" +
      (routeNodes.find(([, target]) => toRaw(target) === toRaw(node))?.[0] ??
        "customers");
    return identity === undefined
      ? path
      : `${path}?record=${encodeURIComponent(JSON.stringify(identity))}`;
  },
  visit(node, identity) {
    void router.push(options.navigation.href(node, identity));
  },
  guard(check) {
    return router.beforeEach(async () => await check());
  },
};
watch(
  () => router.currentRoute.value.fullPath,
  () => {
    const { path, query } = router.currentRoute.value;
    let identity: unknown;
    try {
      identity =
        typeof query.record === "string" ? JSON.parse(query.record) : undefined;
    } catch {
      identity = undefined;
    }
    options.navigation.current = {
      node: routeNodes.find(([key]) => path === "/" + key)?.[1] ?? customers,
      identity,
    };
  },
  { immediate: true },
);
// Durable CAS is a consumer port. This synthetic port contains no secrets.
type Journal = WriteJournal<
  Attempt<object, import("@zerp/ui/model").ModelIdentity>
>;
options.persistence = {
  async pending(owner) {
    const found = new Map<
      string,
      { node: readonly string[]; ancestors: readonly unknown[] }
    >();
    for (const key of Object.keys(localStorage).filter((key) =>
      key.startsWith(storageKey),
    )) {
      const journal = JSON.parse(localStorage.getItem(key)!) as Journal;
      if (
        journal?.attempt?.scope !== JSON.stringify(owner) ||
        journal.completed
      )
        continue;
      const [node, ancestors] = JSON.parse(journal.attempt.resource) as [
        string[],
        unknown[],
      ];
      found.set(journal.attempt.id, { node, ancestors });
    }
    return [...found.values()];
  },
  async load(owner, requestId) {
    return JSON.parse(
      localStorage.getItem(storageKey + (requestId ?? JSON.stringify(owner))) ??
        "null",
    ) as Journal | null;
  },
  async save(journal, expected) {
    const key =
      storageKey +
      JSON.stringify({
        scope: journal.attempt.scope,
        resource: journal.attempt.resource,
      });
    const current = JSON.parse(
      localStorage.getItem(key) ?? "null",
    ) as Journal | null;
    if (
      (current && !current.completed ? current.attempt.id : null) !== expected
    )
      throw Error("原请求 CAS 已变化。");
    localStorage.setItem(key, JSON.stringify(journal));
    localStorage.setItem(
      storageKey + journal.attempt.id,
      JSON.stringify(journal),
    );
  },
  async complete(owner, expected) {
    const key = storageKey + JSON.stringify(owner);
    const journal = JSON.parse(localStorage.getItem(key) ?? "null") as Journal;
    if (journal.attempt.id !== expected || !journal.refreshed)
      throw Error("终态 CAS 不匹配。");
    const done = JSON.stringify({ ...journal, completed: true });
    localStorage.setItem(key, done);
    localStorage.setItem(storageKey + expected, done);
  },
};
export const model = reactive(
  application(
    "模型驱动客户应用",
    {
      login,
      session,
      password,
      customers,
      workbench,
      configuration,
      profile,
      controls,
      notifications,
    },
    options,
  ),
);
