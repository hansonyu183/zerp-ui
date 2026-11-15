/** 唯一公开 model 入口的定向编译检查；不导入或执行宿主、示例或任何业务回调。 */
import type {
  BusinessModel,
  Collection,
  FieldNode,
  ObjectNode,
  Operation,
  PrintTemplate,
  RecordsNode,
  Session,
} from "@zerp/ui/model";

declare const object: ObjectNode;
declare const collection: Collection;
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
// @ts-expect-error Collection 不是子节点。
const nestedCollection = { ...object, members: [collection], } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error 子明细不能独立提交。
const independentDetails = { ...records, operations: { update: operation }, } satisfies RecordsNode;
// prettier-ignore
// @ts-expect-error Collection 不再提供 element。
const legacyElement = { ...collection, element: object } satisfies Collection;
// prettier-ignore
// @ts-expect-error 列定义改为 columns。
const legacyList = { ...collection, list: [] } satisfies Collection;
// prettier-ignore
// @ts-expect-error 查询条件名为 conditions，query 仅是操作名。
const legacyQuery = { ...collection, query: object } satisfies Collection;
// prettier-ignore
// @ts-expect-error 不接受伪装成子节点的 kind。
const legacyCollectionKind = { ...collection, kind: "collection", } satisfies Collection;
// prettier-ignore
// @ts-expect-error 空表需要显式列标题，不能只有 key。
const missingColumnLabel = { ...collection, columns: [{ key: "name" }], } satisfies Collection;
// prettier-ignore
// @ts-expect-error 根 members 只接收独立集合。
const wrongRoot = { ...model, members: { record: object }, } satisfies BusinessModel;
// prettier-ignore
// @ts-expect-error 导航只能指向集合。
const wrongNavigation: BusinessModel["navigation"] = { ...model.navigation, current: object, };
// prettier-ignore
// @ts-expect-error 匿名状态不能携带用户权限。
const wrongSession = { state: "anonymous", owner: null, userPermissions: { administrator: true }, } satisfies Session;

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
const textFormat = { kind: "text", key: "name", label: null, readOnly: false, required: false, value: "", format: {}, } satisfies FieldNode;
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
const invalidCollectionIcon = { ...collection, icon: "mdi-home" } satisfies Collection;
void invalidCollectionIcon;
