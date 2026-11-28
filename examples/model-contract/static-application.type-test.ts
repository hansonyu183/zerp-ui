/** 唯一公开 model 入口的定向编译检查；不导入或执行宿主、示例或任何业务回调。 */
import type {
  BusinessModel,
  Category,
  ListCollection,
  DomainGroup,
  DomainSection,
  FieldNode,
  Node,
  ObjectNode,
  Operation,
  PrintTemplate,
  RecordsNode,
  Session,
  Workbench,
  InteractionNode,
  InteractionAction,
  InteractionDownload,
} from "@zerp/ui/model";

declare const object: ObjectNode;
declare const collection: ListCollection;
declare const records: RecordsNode;
declare const model: BusinessModel;
declare const template: PrintTemplate;
declare const legacyMeta: unique symbol;

const operation = { disabled: false, async run() {} } satisfies Operation;
// prettier-ignore
// @ts-expect-error disabled 是必需属性，不能依靠默认值。
const missingDisabled: Operation = { async run() {} };
// prettier-ignore
// @ts-expect-error 旧禁用原因属性不属于 Operation。
const legacyOperation = { ...operation, disabledReason: "旧协议", } satisfies Operation;
// prettier-ignore
// @ts-expect-error 普通对象不能提供单据审核操作。
const wrongAction = { ...object, family: "standard", operations: { approve: operation }, } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error 单据必须显式提供 type。
const missingVoucherType: ObjectNode = { kind: "object", printable: false, family: "voucher", key: "AA", label: "单据", identity: null, readOnly: false, members: [], operations: {}, };
// prettier-ignore
// @ts-expect-error members 必须是有序节点数组。
const legacyMembers = { ...object, members: { arbitrary: object }, } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error form 已移除。
const legacyForm = { ...object, form: [] } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error 协议名称固定为 label，不再使用 name。
const legacyName = { ...object, name: "旧名称" } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error Symbol 元数据不属于新模型协议。
const legacySymbol = { ...model, [legacyMeta]: {} } satisfies BusinessModel;
// prettier-ignore
// @ts-expect-error ListCollection 不是子节点。
const nestedCollection = { ...object, members: [collection], } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error 子明细不能独立提交。
const independentDetails = { ...records, operations: { update: operation }, } satisfies RecordsNode;
// prettier-ignore
// @ts-expect-error ListCollection 不再提供 element。
const legacyElement = { ...collection, element: object } satisfies ListCollection;
// prettier-ignore
// @ts-expect-error 列定义改为 columns。
const legacyList = { ...collection, list: [] } satisfies ListCollection;
// prettier-ignore
// @ts-expect-error 查询条件名为 conditions，query 仅是操作名。
const legacyQuery = { ...collection, query: object } satisfies ListCollection;
// prettier-ignore
// @ts-expect-error 不接受伪装成子节点的 kind。
const legacyCollectionKind = { ...collection, kind: "collection", } satisfies ListCollection;
// prettier-ignore
// @ts-expect-error 空表需要显式列标题，不能只有 key。
const missingColumnLabel = { ...collection, columns: [{ key: "name" }], } satisfies ListCollection;
// prettier-ignore
// @ts-expect-error 工作区 members 接收栏目、领域或独立集合。
const wrongRoot = { ...model, work: { ...model.work, members: [object] } } satisfies BusinessModel;
// prettier-ignore
// @ts-expect-error 导航只能指向集合。
const wrongNavigation: BusinessModel["work"]["navigation"] = { ...model.work.navigation, current: object, };
// prettier-ignore
// @ts-expect-error 已认证的会话必须有 owner。
const wrongSession = { state: "ready", owner: null } satisfies Session;
// @ts-expect-error 认证操作只声明 signIn。
void model.authentication.operations.recover;
// prettier-ignore
// @ts-expect-error 恢复会话已移除。
const recoveringSession = { state: "recovering", owner: null } satisfies Session;

const singleReference = {
  kind: "reference",
  key: "customer",
  label: "客户",
  readOnly: false,
  required: true,
  multiple: false,
  value: null,
  options: [],
} satisfies FieldNode;
// prettier-ignore
// @ts-expect-error 单选不能使用数组值。
const wrongSingle = { ...singleReference, value: [] } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error 多选不能使用 null。
const wrongMultiple = { ...singleReference, multiple: true, value: null, } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error 引用不建立业务集合关系。
const referenceTarget = { ...singleReference, target: collection, } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error 树候选必须声明 children。
const wrongTree = { ...singleReference, kind: "treeReference", options: [{ id: "1", label: "根", selectable: true }], } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error 文本字段不接受格式配置。
const textFormat = { kind: "text", key: "name", label: "名称", readOnly: false, required: false, value: "", format: {}, } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error decimal 原值仍为字符串。
const numericDecimal = { kind: "decimal", key: "price", label: "价格", readOnly: false, required: false, value: 1, } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error 格式必须使用强类型选项。
const stringFormat = { kind: "date", key: "date", label: "日期", readOnly: false, required: false, value: "", format: "yyyy-MM-dd", } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error JSON 打印模板不能包含运行回调。
const executableTemplate = { ...template, run: operation.run, } satisfies PrintTemplate;
// prettier-ignore
// @ts-expect-error 打印模板不是任意 JSON，必须定义纸张和内容区域。
const arbitraryTemplate: PrintTemplate = { arbitrary: true };

void [
  missingDisabled,
  legacyOperation,
  wrongAction,
  missingVoucherType,
  legacyMembers,
  legacyForm,
  legacyName,
  legacySymbol,
  nestedCollection,
  independentDetails,
  legacyElement,
  legacyList,
  legacyQuery,
  legacyCollectionKind,
  missingColumnLabel,
  wrongRoot,
  wrongNavigation,
  wrongSession,
  wrongSingle,
  wrongMultiple,
  referenceTarget,
  wrongTree,
  textFormat,
  numericDecimal,
  stringFormat,
  executableTemplate,
  arbitraryTemplate,
];

// prettier-ignore
// @ts-expect-error 图标只使用有限业务语义，不接受任意 MDI 图标名。
const invalidCollectionIcon = { ...collection, icon: "mdi-home" } satisfies ListCollection;
void invalidCollectionIcon;

const interactionAction = {
  kind: "action",
  operation,
} satisfies InteractionAction;
const interactions = {
  kind: "interactions",
  key: "script",
  label: "脚本",
  readOnly: false,
  value: {},
  items: [
    {
      kind: "menu",
      id: "menu",
      label: "菜单",
      items: [{ key: "run", label: "运行", target: interactionAction }],
    },
  ],
} satisfies InteractionNode;
// prettier-ignore
// @ts-expect-error 关联只导航，不执行动作。
const actionRelated = {...interactions, items: [{kind: "related", id: "r", label: "关联", target: interactionAction}]} satisfies InteractionNode;
// prettier-ignore
// @ts-expect-error 下载不能误用菜单写入动作端口。
const actionDownload = {...interactions, items: [{kind: "download", id: "d", label: "下载", target: interactionAction}]} satisfies InteractionNode;
// prettier-ignore
// @ts-expect-error 动作必须使用完整 Operation，不能增加字符串命令。
const arbitraryAction = {kind: "action", command: "run"} satisfies InteractionAction;
void [interactions, actionRelated, actionDownload, arbitraryAction];

const fileDownload = {
  kind: "download",
  operation,
} satisfies InteractionDownload;
const scriptDownload = {
  ...interactions,
  items: [
    { kind: "download", id: "file", label: "文件", target: fileDownload },
  ],
} satisfies InteractionNode;
// prettier-ignore
// @ts-expect-error 关联不能使用文件下载端口。
const downloadRelated = {...interactions, items:[{kind:"related",id:"r",label:"关联",target:fileDownload}]} satisfies InteractionNode;
// prettier-ignore
// @ts-expect-error 菜单不能误用文件下载端口。
const downloadMenu = {...interactions,items:[{kind:"menu",id:"m",label:"菜单",items:[{key:"file",label:"文件",target:fileDownload}]}]} satisfies InteractionNode;
void [scriptDownload, downloadRelated, downloadMenu];

// prettier-ignore
// @ts-expect-error scopeKey 是目录依赖的稳定字符串，不接受配置对象。
const invalidScopeKey = {...singleReference, scopeKey: {dependsOn: "parent"}} satisfies FieldNode;
void invalidScopeKey;

const workbenchTargets: Workbench["targets"] = new Map([
  [object, { collection, record: object }],
]);
const managementTarget: Workbench["manageReports"] = { collection };
// prettier-ignore
// @ts-expect-error 快捷目标必须是根集合及可选记录，不能替换为裸对象导航。
const invalidWorkbenchTarget: Workbench["manageReports"] = object;
void [workbenchTargets, managementTarget, invalidWorkbenchTarget];

const domain = {
  kind: "domain",
  key: "customers",
  label: "客户领域",
  members: [collection],
} satisfies DomainGroup;
const section: DomainSection = {
  kind: "section",
  key: "A",
  label: "采购",
  members: [domain],
};
// @ts-expect-error 单据分类只接受领域。
const sectionCollection: DomainSection = { ...section, members: [collection] };
// @ts-expect-error 单据分类固定一层。
const nestedSection: DomainSection = { ...section, members: [section] };
void [sectionCollection, nestedSection];
const category: Category = {
  kind: "category",
  key: "catalog",
  label: "基础资料",
  members: [domain],
};
const node: Node = object;
const groupedModel = {
  ...model,
  work: { ...model.work, members: [category, domain, collection] },
} satisfies BusinessModel;
const keyedRoot = {
  ...model,
  work: {
    ...model.work,
    // @ts-expect-error 工作区成员必须是有序数组。
    members: { customers: domain },
  },
} satisfies BusinessModel;
const keyedDomain = {
  ...domain,
  // @ts-expect-error 领域集合必须是有序数组。
  members: { customers: collection },
} satisfies DomainGroup;
// @ts-expect-error 所属明细的呈现来自行成员。
const explicitDetailColumns = { ...records, columns: [] } satisfies RecordsNode;
void [keyedRoot, keyedDomain, explicitDetailColumns];
// prettier-ignore
// @ts-expect-error 领域只有集合，不接收业务记录。
const domainRecord = { ...domain, members: [object] } satisfies DomainGroup;
// prettier-ignore
// @ts-expect-error 领域固定一层，不递归。
const domainNested = { ...domain, members: [domain] } satisfies DomainGroup;
// prettier-ignore
// @ts-expect-error 领域没有整体保存或查询操作。
const domainSave = { ...domain, operations: { update: operation } } satisfies DomainGroup;
// prettier-ignore
// @ts-expect-error 对象字段不能包含领域。
const domainInObject = { ...object, members: [domain] } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error Router 归 UI 库，业务模型不声明导航对象。
void model.work.navigation;
// prettier-ignore
// @ts-expect-error 集合 load 需要分页参数。
collection.load?.({ id: "aa" });
void [
  node,
  groupedModel,
  domainRecord,
  domainNested,
  domainSave,
  domainInObject,
];

// prettier-ignore
// @ts-expect-error label 必须是字符串。
const nullLabel = { kind: "text", key: "name", label: null, readOnly: false, required: false, value: "" } satisfies FieldNode;
// prettier-ignore
// @ts-expect-error Session 仅提供状态和 owner。
const legacySession = { state: "anonymous", owner: null, presentation: null } satisfies Session;
void [nullLabel, legacySession, recoveringSession];
