/**
 * 2026-11-16 合成静态类型示例，仅参加编译；可运行消费者另见 examples/model。
 * 业务回调仅声明，不访问 API。所有集合、字段和回调均在源码中直接定义。
 */
import { reactive } from "vue";
import type {
  BusinessModel,
  Collection,
  DomainGroup,
  ObjectNode,
  Owner,
  PrintTemplate,
  UserPermissions,
  Workbench,
} from "@zerp/ui/model";

// 消费者实现这些回调；模型构造不调用回调、不读取服务端 schema。
declare function signIn(): Promise<void>;
declare function recoverSession(): Promise<void>;
declare function signOut(): Promise<void>;
declare function changePassword(): Promise<void>;
declare function queryAccountSettings(): Promise<void>;
declare function queryContacts(): Promise<void>;
declare function queryCategories(): Promise<void>;
declare function queryCustomerGroups(): Promise<void>;
declare function queryAttributeDefinitions(): Promise<void>;
declare function queryRelatedDictionaries(): Promise<void>;
declare function queryCustomers(): Promise<void>;
declare function createCustomer(): Promise<void>;
declare function saveCustomer(): Promise<void>;
declare function loadGroups(): Promise<void>;
declare function queryAA(): Promise<void>;
declare function createAA(): Promise<void>;
declare function saveAA(): Promise<void>;
declare function submitAA(): Promise<void>;
declare function queryAB(): Promise<void>;
declare function createAB(): Promise<void>;
declare function saveAB(): Promise<void>;
declare function approveAB(): Promise<void>;
declare function addLine(): Promise<void>;
declare function removeLine(): Promise<void>;
declare function loadWorkbench(): Promise<void>;
declare function openAA(): Promise<void>;
declare const href: BusinessModel["navigation"]["href"];
declare const visit: BusinessModel["navigation"]["visit"];

/** 新记录结构示例，不是 element，也不在登录前安装为业务数据。 */
export const customerDraft = reactive({
  kind: "object",
  printable: false,
  family: "standard",
  key: "customer-draft",
  label: "客户",
  identity: null,
  readOnly: false,
  members: [
    {
      kind: "text",
      key: "name",
      label: "名称",
      value: "",
      required: true,
      readOnly: false,
    },
    // null 隐藏整个详情/编辑字段，仍能通过 key 用于列和打印。
    {
      kind: "text",
      key: "internalCode",
      label: null,
      value: "",
      required: false,
      readOnly: true,
    },
    {
      kind: "reference",
      key: "category",
      label: "分类",
      required: false,
      readOnly: false,
      multiple: false,
      value: null,
      options: [
        { id: "standard", label: "普通", selectable: true },
        { id: "retired", label: "停用", selectable: false },
      ],
    },
    {
      kind: "treeReference",
      key: "groups",
      label: "分组",
      required: false,
      readOnly: false,
      multiple: true,
      value: [],
      options: [],
      load: { disabled: false, run: loadGroups },
    },
    {
      kind: "object",
      printable: false,
      family: "standard",
      key: "settlement",
      label: "结算",
      identity: null,
      readOnly: false,
      members: [
        {
          kind: "decimal",
          key: "credit",
          label: "额度",
          value: "",
          required: false,
          readOnly: false,
          format: { minimumFractionDigits: 2, useGrouping: true, unit: "元" },
        },
        {
          kind: "date",
          key: "effectiveDate",
          label: "生效日期",
          value: "",
          required: false,
          readOnly: false,
          format: { year: "numeric", month: "2-digit", day: "2-digit" },
        },
        {
          kind: "datetime",
          key: "updatedAt",
          label: "更新时间",
          value: "",
          required: false,
          readOnly: true,
          format: { timeZone: "Asia/Shanghai", hour12: false },
        },
      ],
      // 所属分组没有独立保存按钮，随客户保存。
      operations: {},
    },
  ],
  operations: { update: { disabled: false, run: saveCustomer } },
} satisfies ObjectNode);

/** AA 共用 ObjectNode；type 表达业务类型，不是独立的 VoucherNode 接口。 */
export const aaDraft = reactive({
  kind: "object",
  printable: false,
  family: "voucher",
  type: "AA",
  key: "aa-draft",
  label: "采购订单",
  identity: null,
  readOnly: false,
  members: [
    {
      kind: "text",
      key: "number",
      label: "单号",
      value: "",
      required: false,
      readOnly: true,
    },
    {
      kind: "date",
      key: "date",
      label: "日期",
      value: "",
      required: true,
      readOnly: false,
      format: { year: "numeric", month: "2-digit", day: "2-digit" },
    },
    {
      kind: "records",
      key: "lines",
      label: "明细",
      readOnly: false,
      columns: [
        { key: "product", label: "产品" },
        { key: "quantity", label: "数量" },
      ],
      items: [],
      selected: null,
      // 本地增删行，不独立查询/提交；随 AA 的 update 一起保存。
      operations: {
        create: { disabled: false, run: addLine },
        remove: { disabled: true, run: removeLine },
      },
    },
  ],
  operations: {
    update: { disabled: false, run: saveAA },
    submit: { disabled: true, run: submitAA },
  },
} satisfies ObjectNode);

/** addLine 创建的子明细结构；不同新行要建立不同节点，不能共享本对象。 */
export const aaLine = reactive({
  kind: "object",
  printable: false,
  family: "standard",
  key: "aa-line-local-1",
  label: "明细行",
  identity: null,
  readOnly: false,
  members: [
    {
      kind: "reference",
      key: "product",
      label: "产品",
      required: true,
      readOnly: false,
      multiple: false,
      value: null,
      options: [],
    },
    {
      kind: "decimal",
      key: "quantity",
      label: "数量",
      value: "",
      required: true,
      readOnly: false,
      format: { maximumFractionDigits: 3 },
    },
  ],
  operations: {},
} satisfies ObjectNode);

/** AB 底层相同，但字段、业务回调及当前可用动作不同。 */
export const abDraft = reactive({
  kind: "object",
  printable: false,
  family: "voucher",
  type: "AB",
  key: "ab-draft",
  label: "采购收货",
  identity: null,
  readOnly: false,
  members: [
    {
      kind: "text",
      key: "number",
      label: "单号",
      value: "",
      required: false,
      readOnly: true,
    },
    {
      kind: "treeReference",
      key: "warehouse",
      label: "仓库",
      required: true,
      readOnly: false,
      multiple: false,
      value: null,
      options: [
        {
          id: "region",
          label: "区域",
          selectable: false,
          children: [
            {
              id: "warehouse",
              label: "合成仓库",
              selectable: true,
              children: [],
            },
          ],
        },
      ],
    },
  ],
  operations: {
    update: { disabled: false, run: saveAB },
    approve: { disabled: true, run: approveAB },
  },
} satisfies ObjectNode);

/** 单条客户模板：强类型 JSON，绑定成员 key；不包含回调或表达式。 */
const itemPrintTemple = {
  label: "客户",
  page: { width: 210, height: 297, margin: 10 },
  header: { height: 0, items: [] },
  footer: { height: 0, items: [] },
  body: [
    {
      kind: "record",
      height: 12,
      items: [
        {
          kind: "field",
          key: "name",
          path: ["name"],
          x: 0,
          y: 0,
          width: 90,
          height: 10,
        },
        {
          kind: "field",
          key: "code",
          path: ["internalCode"],
          x: 95,
          y: 0,
          width: 90,
          height: 10,
        },
      ],
    },
  ],
} satisfies PrintTemplate;

/** 集合模板：[] 仅指当前页 items，打印不自动读取其他页。 */
const printTemple = {
  label: "客户列表",
  page: { width: 210, height: 297, margin: 10 },
  header: { height: 0, items: [] },
  footer: { height: 0, items: [] },
  body: [
    {
      kind: "records",
      path: [],
      headerHeight: 8,
      rowHeight: 8,
      columns: [
        { path: ["name"], label: "名称", width: 100 },
        { path: ["internalCode"], label: "内部编码", width: 90 },
      ],
    },
  ],
} satisfies PrintTemplate;

const customers = reactive<Collection>({
  key: "customers",
  label: "客户",
  columns: [
    { key: "name", label: "名称" },
    { key: "internalCode", label: "内部编码" },
  ],
  conditions: {
    kind: "object",
    printable: false,
    family: "standard",
    key: "customer-conditions",
    label: "查询条件",
    identity: null,
    readOnly: false,
    members: [
      {
        kind: "text",
        key: "keyword",
        label: "关键词",
        value: "",
        required: false,
        readOnly: false,
      },
    ],
    operations: {},
  },
  // 登录前 items/draft 均为空；列名直接来自 columns，无需 element。
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {
    query: { disabled: false, run: queryCustomers },
    create: { disabled: false, run: createCustomer },
  },
  itemPrintTemple,
  printTemple,
});

const aa = reactive<Collection>({
  key: "AA",
  label: "AA 采购订单",
  columns: [
    { key: "number", label: "单号" },
    { key: "date", label: "日期" },
  ],
  conditions: {
    kind: "object",
    printable: false,
    family: "standard",
    key: "aa-conditions",
    label: "查询条件",
    identity: null,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {
    query: { disabled: false, run: queryAA },
    create: { disabled: false, run: createAA },
  },
});
const ab = reactive<Collection>({
  key: "AB",
  label: "AB 采购收货",
  columns: [
    { key: "number", label: "单号" },
    { key: "warehouse", label: "仓库" },
  ],
  conditions: {
    kind: "object",
    printable: false,
    family: "standard",
    key: "ab-conditions",
    label: "查询条件",
    identity: null,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {
    query: { disabled: false, run: queryAB },
    create: { disabled: false, run: createAB },
  },
});

const workbench = reactive<Workbench>({
  load: { disabled: false, run: loadWorkbench },
  information: {
    kind: "records",
    key: "information",
    label: "重要信息",
    readOnly: true,
    columns: [{ key: "text", label: "内容" }],
    items: [],
    selected: null,
    operations: {},
  },
  vouchers: {
    kind: "records",
    key: "vouchers",
    label: "单据",
    readOnly: true,
    columns: [{ key: "text", label: "名称" }],
    items: [],
    selected: null,
    operations: {},
  },
  reports: {
    kind: "records",
    key: "reports",
    label: "报表",
    readOnly: true,
    columns: [{ key: "text", label: "名称" }],
    items: [],
    selected: null,
    operations: {},
  },
  masters: {
    kind: "records",
    key: "masters",
    label: "资料",
    readOnly: true,
    columns: [{ key: "text", label: "名称" }],
    items: [],
    selected: null,
    operations: {},
  },
});

/** 工作台行的 get 可调用消费者导航；它本身不成为全局导航目标。 */
export const voucherShortcut = {
  kind: "object",
  printable: false,
  family: "standard",
  key: "shortcut-aa",
  label: "采购订单",
  identity: "synthetic:shortcut:AA",
  readOnly: true,
  members: [
    {
      kind: "text",
      key: "text",
      label: "名称",
      value: "采购订单",
      required: false,
      readOnly: true,
    },
  ],
  operations: { get: { disabled: false, run: openAA } },
} satisfies ObjectNode;

/** 合成独立目录：每个集合有自己的查询回调、条件、分页和记录保存回调。 */
const accountSettings = reactive<Collection>({
  key: "accountSettings",
  label: "账款设置",
  columns: [{ key: "name", label: "名称" }],
  conditions: {
    kind: "object",
    family: "standard",
    key: "accountSettings-conditions",
    label: "查询条件",
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: { query: { disabled: false, run: queryAccountSettings } },
});
const contacts = reactive<Collection>({
  key: "contacts",
  label: "联系人",
  columns: [{ key: "name", label: "名称" }],
  conditions: {
    kind: "object",
    family: "standard",
    key: "contacts-conditions",
    label: "查询条件",
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: { query: { disabled: false, run: queryContacts } },
});
const categories = reactive<Collection>({
  key: "categories",
  label: "分类",
  columns: [{ key: "name", label: "名称" }],
  conditions: {
    kind: "object",
    family: "standard",
    key: "categories-conditions",
    label: "查询条件",
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: { query: { disabled: false, run: queryCategories } },
});
const customerGroups = reactive<Collection>({
  key: "customerGroups",
  label: "分组",
  columns: [{ key: "name", label: "名称" }],
  conditions: {
    kind: "object",
    family: "standard",
    key: "customerGroups-conditions",
    label: "查询条件",
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: { query: { disabled: false, run: queryCustomerGroups } },
});
const attributeDefinitions = reactive<Collection>({
  key: "attributeDefinitions",
  label: "属性定义",
  columns: [{ key: "name", label: "名称" }],
  conditions: {
    kind: "object",
    family: "standard",
    key: "attributeDefinitions-conditions",
    label: "查询条件",
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: { query: { disabled: false, run: queryAttributeDefinitions } },
});
const relatedDictionaries = reactive<Collection>({
  key: "relatedDictionaries",
  label: "相关字典",
  columns: [{ key: "name", label: "名称" }],
  conditions: {
    kind: "object",
    family: "standard",
    key: "relatedDictionaries-conditions",
    label: "查询条件",
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: { query: { disabled: false, run: queryRelatedDictionaries } },
});
/** 领域不是 ObjectNode，没有整体 query/update，也不授予集合权限。 */
export const customerDomain = reactive({
  kind: "domain",
  key: "customerDomain",
  label: "客户领域",
  members: {
    customers,
    accountSettings,
    contacts,
    categories,
    customerGroups,
    attributeDefinitions,
    relatedDictionaries,
  },
} satisfies DomainGroup);

/** 登录前整体传入，登录/登出/再次登录只更新同一响应式对象。 */
export const model: BusinessModel = reactive({
  kind: "application",
  label: "OIT 合成示例",
  brand: { productName: "OIT 示例", companyName: "" },
  members: { customerDomain, AA: aa, AB: ab },
  workbench,
  theme: {
    value: { preset: "md3", mode: "light" },
    change(value) {
      model.theme!.value = value;
    },
  },
  authentication: {
    form: {
      kind: "object",
      printable: false,
      family: "standard",
      key: "signin",
      label: "登录",
      identity: null,
      readOnly: false,
      members: [
        {
          kind: "reference",
          key: "ledger",
          label: "账套",
          required: true,
          readOnly: false,
          multiple: false,
          value: null,
          options: [{ id: "synthetic", label: "合成账套", selectable: true }],
        },
        {
          kind: "text",
          key: "identifier",
          label: "账号",
          required: true,
          readOnly: false,
          value: "",
        },
        {
          kind: "password",
          key: "password",
          label: "密码",
          required: true,
          readOnly: false,
          value: "",
        },
      ],
      operations: {},
    },
    operations: {
      signIn: { disabled: false, run: signIn },
      recover: { disabled: false, run: recoverSession },
    },
  },
  account: {
    label: "",
    profile: {
      kind: "object",
      printable: false,
      family: "standard",
      key: "profile",
      label: "个人资料",
      identity: null,
      readOnly: true,
      members: [
        {
          kind: "text",
          key: "displayName",
          label: "姓名",
          value: "",
          required: false,
          readOnly: true,
        },
      ],
      operations: {},
    },
    password: {
      kind: "object",
      printable: false,
      family: "standard",
      key: "password",
      label: "修改密码",
      identity: null,
      readOnly: false,
      members: [
        {
          kind: "password",
          key: "newPassword",
          label: "新密码",
          value: "",
          required: true,
          readOnly: false,
        },
      ],
      operations: {},
    },
    operations: {
      changePassword: { disabled: false, run: changePassword },
      signOut: { disabled: false, run: signOut },
    },
  },
  session: { state: "anonymous", owner: null, userPermissions: null },
  // null 表示工作台；详情与编辑留在集合的 selected/draft 内。
  navigation: {
    current: null,
    groups: [
      {
        key: "masters",
        label: "客户领域",
        items: [
          customers,
          accountSettings,
          contacts,
          categories,
          customerGroups,
          attributeDefinitions,
          relatedDictionaries,
        ],
      },
      { key: "vouchers-A", label: "采购", items: [aa, ab] },
    ],
    href,
    visit,
  },
  messages: [],
} satisfies BusinessModel);

/** 后端权限标识映射到现有节点；UI 负责裁剪，不由消费者重新装配模型。 */
export function customerPermissions(owner: Owner): UserPermissions {
  return {
    owner,
    administrator: false,
    grants: [
      {
        node: customers,
        read: true,
        write: true,
        operations: {
          query: true,
          create: true,
          update: true,
          print: true,
          itemPrint: true,
          load: true,
        },
      },
      { node: workbench.information, read: true, write: false, operations: {} },
    ],
  };
}

// signIn/recover 检查当前请求有效性后写入 model.session；权限 owner 须匹配会话。
// create 回调为每次新增直接构造独立记录；上述 draft/line 仅展示源码结构，不复用为多条记录。
// signOut 撤销授权、清空输入/记录/缓存/消息并使迟到响应失效，根 model 不替换。
// UI 若直接裁剪对象，负责恢复其结构；消费者负责清空恢复节点中的旧会话业务数据。
