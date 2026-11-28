/** 唯一公开静态响应式模型；接口决定见 #152，迁移及有限能力补齐见 #159。 */
import type { PrintBox, PrintDocument, PrintTextStyle } from "./print";
import type { Interaction } from "./collaboration";
import type { ReportPresentation, ReportSummary } from "./report";

export type NavigationIcon =
  "home" | "catalog" | "settings" | "report" | "voucher" | "workflow";

/** 操作缺省、所属节点不可读或 disabled 为 true 时省略入口和调用。 */
export interface Operation<T = void> {
  disabled: boolean;
  /** 同步操作返回 void，异步操作返回代表完成的 Promise。消费者负责业务有效性及迟到回写。 */
  run(input: T): void | Promise<void>;
}

/** 身份、账套及本次登录批次；不能仅以账号相同判断请求仍有效。 */
export interface Owner {
  ledger: string;
  operator: string;
  generation: string;
}

/** key 在同一所属对象内稳定且唯一，不随显示文案或数组重排变化。 */
interface NodeBase {
  key: string;
  label: string;
  /** false 排除节点及其所属内容的读取、呈现和操作。缺省可读。 */
  readable?: boolean;
  /** 节点及所属表单输入的只读状态。 */
  readOnly: boolean;
}

/** 日期格式只影响显示；省略时使用本地语言的年月日格式。 */
export interface DateFormat {
  locale?: string;
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short";
  day?: "numeric" | "2-digit";
}

/** 日期时间的显式显示时区；原值包含时区，不由显示格式改变业务时间。 */
export interface DateTimeFormat extends DateFormat {
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
  hour12?: boolean;
  timeZone?: string;
}

/** 仅格式化展示，不通过 Number 转换损失十进制原值精度。 */
export interface DecimalFormat {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  /** 显示在格式化值后的业务单位，不写回 value。 */
  unit?: string;
}

/** 已选值自带历史显示名，不要求仍存在于当前候选目录。 */
export interface ReferenceValue {
  id: string;
  label: string;
}

export interface SelectOption extends ReferenceValue {
  /** false 时可回显，但用户不能新选中。 */
  selectable: boolean;
}

/** 每层都使用同样的候选语义；搜索保留命中项的祖先路径。 */
export interface TreeOption extends SelectOption {
  children: TreeOption[];
}

type ReferenceField = NodeBase & {
  required: boolean;
  /** 候选目录业务依赖的作用域键；变化后清除旧目录并按需重新读取。owner 由宿主隔离。 */
  scopeKey?: string;
  /** 动态目录首次需要时加载；静态目录直接提供 options。 */
  load?: Operation;
} & (
    | { kind: "reference"; options: SelectOption[] }
    | { kind: "treeReference"; options: TreeOption[] }
  ) &
  (
    | { multiple: false; value: ReferenceValue | null }
    | { multiple: true; value: ReferenceValue[] }
  );

/** 字段值直接响应用户输入；引用只负责选值，没有集合 target 或资料维护入口。 */
export type FieldNode =
  | (NodeBase & {
      kind: "text" | "longText" | "password";
      value: string;
      required: boolean;
    })
  | (NodeBase & {
      kind: "date";
      /** 空字符串表示未填；有值时采用 YYYY-MM-DD，不转换时区。 */
      value: string;
      required: boolean;
      format?: DateFormat;
    })
  | (NodeBase & {
      kind: "datetime";
      /** 空字符串表示未填；有值时为包含时区的 ISO 8601 日期时间。 */
      value: string;
      required: boolean;
      format?: DateTimeFormat;
    })
  | (NodeBase & {
      kind: "decimal";
      /** 十进制字符串；输入中的中间值和后端业务校验由消费者处理。 */
      value: string;
      required: boolean;
      format?: DecimalFormat;
    })
  | (NodeBase & {
      kind: "integer";
      /** null 是未填，0 是有效值。 */
      value: number | null;
      required: boolean;
    })
  | (NodeBase & { kind: "boolean"; value: boolean })
  | (NodeBase & {
      kind: "secret";
      required: boolean;
      /** 区分保留原秘密、替换和清除，不将后端秘密明文放入模型。 */
      value:
        | { intent: "keep" }
        | { intent: "replace"; value: string }
        | { intent: "clear" };
    })
  | (NodeBase & { kind: "attachments"; multiple: boolean; value: File[] })
  | ReferenceField;

/** 对象操作的提交边界只覆盖该对象及其所属明细。 */
export interface ObjectOperations {
  /** 接收当前响应式业务对象，成功时由消费者写回确认值。 */
  update?: Operation<ObjectNode>;
  delete?: Operation;
  /** 查询权威结果，不重发原写入；关闭反馈不等于核实完成。 */
  reconcile?: Operation;
}

/** 单据固定操作全集；缺省表示当前对象不提供该动作。 */
export interface VoucherOperations {
  submit?: Operation;
  approve?: Operation;
  withdraw?: Operation;
  reverse?: Operation;
  calculate?: Operation;
  stageAttachments?: Operation;
  clone?: Operation;
  send?: Operation;
  unapprove?: Operation;
  complete?: Operation;
  uncomplete?: Operation;
  void?: Operation;
  unvoid?: Operation;
}

/** 固定业务能力保留各自操作词汇；不改变 standard/voucher 的对象种类。 */
export interface ObjectCapabilities {
  document?: {
    operations: Partial<
      Record<
        "submit" | "approve" | "enable" | "disable" | "stageAttachments",
        Operation
      >
    >;
  };
  workflow?: {
    operations: Partial<
      Record<
        | "start"
        | "advance"
        | "createChild"
        | "approveChild"
        | "rejectChild"
        | "retryChild"
        | "cancelChild"
        | "openVoucher"
        | "audit"
        | "cancel",
        Operation
      >
    >;
  };
  processing?: {
    operations: Partial<
      Record<
        | "process"
        | "publish"
        | "restore"
        | "validate"
        | "run"
        | "stop"
        | "import",
        Operation
      >
    >;
  };
  batch?: { operations: Partial<Record<"executeBatch" | "cancel", Operation>> };
  report?: { operations: Partial<Record<"calculate" | "export", Operation>> };
  output?: {
    operations: Partial<
      Record<
        "preview" | "print" | "confirmPrinted" | "confirmNotPrinted",
        Operation
      >
    >;
  };
}

interface ObjectBase extends NodeBase, ObjectCapabilities {
  kind: "object";
  /** 可打开记录窗口的对象声明静态业务类型。 */
  businessType?: string;
  /** 打开或切入记录窗口时读取当前记录，完成前将结果写入原对象。 */
  load?: (id: string) => Promise<void>;
  /** 正式记录的稳定业务身份；分组、条件和未保存记录可为 null。 */
  identity: string | null;
  /** 当前值及所属明细已被权威确认可打印；输入、待保存或结果未知时由消费者置 false。 */
  printable: boolean;
  /** 数组顺序就是呈现顺序；嵌套对象表达分组，不另设 form 或 Tab 配置。 */
  members: Node[];
}

/** 普通对象和单据使用同一种对象契约，单据特有属性由 family 约束。 */
export type ObjectNode = ObjectBase &
  (
    | { family: "standard"; operations: ObjectOperations }
    | {
        family: "voucher";
        /** 如 AA、AB；消费者定义业务类型码，UI 不按类型码猜测交互。 */
        readonly type: string;
        operations: ObjectOperations & VoucherOperations;
      }
  );

/** 引用记录的直接成员 key；列名独立提供，空表也能显示标题。 */
export interface Column {
  key: string;
  label: string;
}

/** 对象所属子明细，或工作台内容；不是独立业务集合。 */
export interface RecordsNode extends NodeBase {
  kind: "records";
  /** 各行按同一静态定义构造独立节点，members 的顺序及标签决定明细呈现。 */
  items: ObjectNode[];
  selected: ObjectNode | null;
  /** 仅改变所属模型的本地明细；最终保存由父对象 update 完成。 */
  operations: {
    create?: Operation<RecordsNode>;
    remove?: Operation<RecordsNode>;
  };
}

/** Collection 不属于节点联合，不能作为 ObjectNode 的子明细。 */
/** 局部关联入口始终归属于独立集合；选中记录不成为全局导航目标。 */
export interface CollectionTarget {
  collection: ListCollection;
  record?: ObjectNode;
}

/** 复用有限文档输出；预览和打印不自动确认实体结果。 */
export interface OutputNode extends NodeBase {
  kind: "output";
  value: PrintDocument | null;
  operations: Partial<
    Record<
      "print" | "confirmPrinted" | "confirmNotPrinted" | "reconcile",
      Operation
    >
  >;
}

/** 有限脚本问题与局部目录，无任意命令或组件/render 扩展点。 */
export interface InteractionAction {
  kind: "action";
  /** 仅在 menu/tree 选择时调用；资格由所属节点的 interact 权限及业务禁用共同控制。 */
  operation: Operation;
}

/** 已产生业务文件的独立下载，不替换所属集合的导出操作。 */
export interface InteractionDownload {
  kind: "download";
  operation: Operation;
}

export interface InteractionNode extends NodeBase {
  kind: "interactions";
  value: Record<string, string | boolean>;
  items: readonly Interaction<
    CollectionTarget,
    InteractionAction,
    InteractionDownload
  >[];
}

export type Node =
  FieldNode | ObjectNode | RecordsNode | OutputNode | InteractionNode;

/** 从当前记录依次按 members.key 查找；数组仅表达成员路径，不执行字符串表达式。 */
export type FieldPath = readonly [string, ...string[]];

/** 有限元素样式，不接受 CSS、脚本、表达式或远程资源。 */
export type PrintElement = PrintBox &
  (
    | ({ kind: "text"; text: string } & PrintTextStyle)
    | ({ kind: "field"; path: FieldPath } & PrintTextStyle)
    | ({ kind: "pageNumber" } & PrintTextStyle)
    | { kind: "image"; src: string; alt: string }
    | { kind: "line" | "rect" }
  );

/** JSON 模板，在 UI 绑定数据后生成现有打印器接收的有限文档。 */
export interface PrintTemplate {
  label: string;
  page: {
    width: number;
    height: number;
    rotation?: 0 | 90 | 180 | 270;
    margin: number;
  };
  /** 页眉页脚固定预留高度；每页重复，不占用正文分页空间。 */
  header: { height: number; items: PrintElement[] };
  footer: { height: number; items: PrintElement[] };
  body: (
    | {
        /** 单条记录区域；用于 itemPrintTemple，字段相对当前记录。 */
        kind: "record";
        height: number;
        items: PrintElement[];
      }
    | {
        kind: "records";
        /** [] 表示当前 Collection.items；非空路径指向当前记录的 RecordsNode。 */
        path: readonly string[];
        /** 最小表头高度（毫米）；跨页重复，按文字测量撑高。 */
        headerHeight: number;
        /** 最小行高（毫米）；文字自动换行撑高，不跨页拆行。 */
        rowHeight: number;
        columns: ({
          path: FieldPath;
          label: string;
          width: number;
        } & PrintTextStyle)[];
      }
  )[];
}

/** 独立查询和写入的业务集合；普通资料与 AA/AB 等单据共用。 */
export interface ListCollection {
  /** 在所属 BusinessModel.work.members 或 DomainGroup.members 中的稳定集合键。 */
  key: string;
  label: string;
  /** false 排除集合及其所属节点。缺省可读。 */
  readable?: boolean;
  columns: Column[];
  /** 查询条件与 query 操作分开；输入不自动触发后端查询。 */
  conditions: ObjectNode;
  items: ObjectNode[];
  selected: ObjectNode | null;
  /** 按地址打开分页之外的记录时，提供由静态定义构造的原业务对象。 */
  resolveRecord?: (id: string) => ObjectNode | undefined;
  /** 新增记录本身，由 create 回调直接构造其完整字段及回调。 */
  draft: ObjectNode | null;
  page: number;
  pageSize: number;
  total: number;
  load?: (request: { page: number; pageSize: number }) => Promise<void>;
  operations: {
    query?: Operation<{ page: number; pageSize: number }>;
    create?: Operation;
    export?: Operation;
  };
  /** 自动产生单条记录打印入口；缺省不显示。拼写沿用用户确认的接口。 */
  itemPrintTemple?: PrintTemplate;
  /** 读取结果的有限呈现事实；数值及合计仍归消费者。 */
  report?: {
    summary?: ReportSummary<Record<string, string | number | boolean | null>>;
    presentation?: ReportPresentation<
      Record<string, string | number | boolean | null>,
      string
    >;
    cells?: readonly {
      row: ObjectNode;
      field: string;
      kind: "record" | "detail" | "select";
      target: CollectionTarget;
      label: string;
      disabled: boolean;
    }[];
  };
  /** 自动打印当前页 items，不追加查询；缺省不显示。 */
  printTemple?: PrintTemplate;
}

/** 仅组织并列独立集合的领域入口；不是业务记录、权限或整体写入边界。 */
export interface DomainGroup {
  kind: "domain";
  key: string;
  label: string;
  icon?: NavigationIcon;
  /** 停用等业务状态可收起侧栏入口；已授权链接仍可直达。 */
  hiddenFromNavigation?: boolean;
  /** 按数组顺序呈现，集合 key 在领域内唯一。 */
  members: ListCollection[];
}

/** 栏目内可折叠的业务分类，例如单据下的采购。 */
export interface DomainSection {
  kind: "section";
  key: string;
  label: string;
  members: DomainGroup[];
}

/** 顶层业务栏目；成员顺序决定侧栏顺序。 */
export interface Category {
  kind: "category";
  key: string;
  label: string;
  members: (DomainGroup | DomainSection)[];
}

/** 权限仍需同时满足节点业务限制；全体操作名封闭。 */
export type Session =
  | { state: "anonymous" | "recovering"; owner: null }
  | { state: "ready" | "password-required"; owner: Owner };

/** 首页集合，使用固定四块布局。 */
export interface Workbench {
  key: string;
  label: string;
  readable?: boolean;
  load?: () => Promise<void>;
  /** 真实快捷记录的目标，只保存已有节点引用；不预取或改变目标集合当前页。 */
  targets?: ReadonlyMap<ObjectNode, CollectionTarget>;
  /** 常用报表的独立维护集合。 */
  manageReports?: { collection: ListCollection; record?: never };
  information: RecordsNode;
  vouchers: RecordsNode;
  reports: RecordsNode;
  masters: RecordsNode;
}

export type Collection = ListCollection | Workbench;

/** 登录前整体传入；登录、退出、再次登录保持同一响应式根对象。 */
export interface BusinessModel {
  kind: "application";
  label: string;
  brand: {
    productName: string;
    companyName: string;
    /** 可选主题品牌主色与辅色，省略时使用预设颜色。 */
    primary?: string;
    secondary?: string;
  };
  /** 省略时默认 MD3 浅色；选择持久化由消费者负责。 */
  theme?: {
    value: { preset: "md1" | "md2" | "md3"; mode: "light" | "dark" };
    change(value: {
      preset: "md1" | "md2" | "md3";
      mode: "light" | "dark";
    }): void;
  };
  authentication: {
    form: ObjectNode;
    operations: { signIn: Operation; recover: Operation };
  };
  session: Session;
  work: {
    /** 栏目和领域生成侧栏；直属集合可直接定位，不生成菜单项。 */
    members: (Category | DomainGroup | ListCollection)[];
    workbench?: Workbench;
    account: {
      label: string;
      profile: ObjectNode;
      password: ObjectNode;
      operations: { changePassword: Operation; signOut: Operation };
    };
  };
  /** 统一反馈；登出清理，关闭消息不代表业务结果已核实。 */
  messages: {
    id: string;
    level: "info" | "success" | "warning" | "error";
    text: string;
    /** Require acknowledgment before continuing to interact with the UI. */
    blocking?: true;
    /** 反馈定位不产生新的全局导航目标。 */
    target: ListCollection | Node | null;
  }[];
}
