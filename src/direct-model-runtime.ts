import { modelCollections } from "./model-collections";
import { directFeedback } from "./direct-feedback";
import {
  computed,
  ref,
  shallowReactive,
  shallowRef,
  toRaw,
  type ComputedRef,
  type Ref,
  type InjectionKey,
} from "vue";
import type {
  BusinessModel,
  BusinessNode,
  Collection,
  ObjectNode,
  Operation,
  Owner,
  InteractionNode,
  CollectionTarget,
} from "./business-model";
export type { ObjectNode } from "./business-model";
export type CollectionNode = Collection;
export type Node = BusinessNode | Collection;
export type Target = ObjectNode | Collection;
export type Action = Operation;
export function isCollection(node: Node): node is Collection {
  return "conditions" in node;
}
export function members(node: Node): [string, BusinessNode][] {
  return !isCollection(node) && node.kind === "object"
    ? node.members.map((child) => [child.key, child])
    : [];
}
type QueryView =
  | { state: "loading" | "success"; page: number }
  | {
      state: "failure";
      page: number;
      retryPage: number;
      canRetry: () => boolean;
      error: string;
    };
export interface DirectRuntime {
  model: () => BusinessModel;
  scope: ComputedRef<string>;
  ready: ComputedRef<boolean>;
  busy: Ref<Set<object>>;
  feedback: ReturnType<typeof directFeedback>;
  queryView(collection: Collection): QueryView | undefined;
  reportViews: Map<object, { left: number; top: number }>;
  contains(node: Node): boolean;
  ancestors(node: Node): Node[];
  readable(node: Node): boolean;
  writable(node: Node): boolean;
  independent(node: Node): boolean;
  editable(node: Node): boolean;
  handleable(node: ObjectNode): boolean;
  allowed(node: Node, action: string, publicAuth?: boolean): boolean;
  operations(node: Node): Record<string, Operation>;
  available(node: Node, action: string, publicAuth?: boolean): boolean;
  run(node: Node, action: string, publicAuth?: boolean): Promise<void>;
  interactable(node: InteractionNode): boolean;
  downloadable(node: InteractionNode): boolean;
  runDownload(
    node: InteractionNode,
    operation: Operation,
    valid: () => boolean,
  ): Promise<void>;
  runInteraction(
    node: InteractionNode,
    operation: Operation,
    valid: () => boolean,
  ): Promise<void>;
  runAccount(action?: "signOut" | "changePassword"): Promise<void>;
  runWorkbench(once?: boolean): Promise<void>;
  invalidate(scopeChanged?: boolean): void;
}
// Track only the live condition values. The token invalidates retry without
// copying the query payload or writing a previous value back into the model.
function trackConditions(node: BusinessNode) {
  if (node.kind === "object") {
    node.members.forEach(trackConditions);
  } else if (node.kind === "records") {
    node.items.forEach(trackConditions);
  } else if (node.kind !== "output") {
    const value = node.value;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if ("id" in entry) void entry.id;
      }
    } else if (value && typeof value === "object") {
      Object.values(value);
    }
  }
}
function retryGuard(collection: Collection) {
  const revision = computed(() => {
    trackConditions(collection.conditions);
    return Symbol();
  });
  const requested = revision.value;
  return () => revision.value === requested;
}
export function createDirectRuntime(model: () => BusinessModel): DirectRuntime {
  const ownerKey = (owner: Owner | null) =>
    owner
      ? JSON.stringify([owner.ledger, owner.operator, owner.generation])
      : "";
  const scope = computed(() => ownerKey(model().session.owner));
  const ready = computed(() => {
    const s = model().session;
    return (
      (s.state === "ready" || s.state === "password-required") &&
      s.owner !== null
    );
  });
  const busy = ref(new Set<object>());
  const executions = new Map<object, symbol>();
  const feedbackExecutions = new Set<symbol>();
  const feedback = directFeedback(model, scope, readable, ancestors, () =>
    feedbackExecutions.size === 1
      ? feedbackExecutions.values().next().value
      : undefined,
  );
  const queries = shallowRef(
    shallowReactive(new WeakMap<Collection, QueryView>()),
  );
  const reportViews = new Map<object, { left: number; top: number }>();
  let epoch = 0;
  const workbenchLoads = new WeakMap<object, Set<string>>();
  const structuralPaths = computed(() => {
    const result = new Map<object, Node[]>();
    const targets: CollectionTarget[] = [];
    function collect(target: unknown) {
      if (target && typeof target === "object" && "collection" in target)
        targets.push(target as CollectionTarget);
    }
    function walk(node: Node, parents: Node[]) {
      if (result.has(toRaw(node))) return;
      result.set(toRaw(node), parents);
      if (isCollection(node)) {
        walk(node.conditions, [...parents, node]);
        for (const item of [...node.items, node.selected, node.draft])
          if (item) walk(item, [...parents, node]);
        for (const cell of node.report?.cells ?? []) collect(cell.target);
      } else if (node.kind === "object")
        for (const child of node.members) walk(child, [...parents, node]);
      else if (node.kind === "records")
        for (const item of node.items) walk(item, [...parents, node]);
      else if (node.kind === "interactions")
        for (const item of node.items) {
          if ("target" in item) collect(item.target);
          if (item.kind === "menu" || item.kind === "tree")
            for (const entry of item.items) {
              collect(entry.target);
              for (const child of entry.children ?? []) collect(child.target);
            }
        }
    }
    for (const node of modelCollections(model())) walk(node, []);
    const w = model().workbench;
    if (w)
      for (const node of [w.information, w.vouchers, w.reports, w.masters])
        walk(node, []);
    for (const node of [
      model().authentication.form,
      model().account.profile,
      model().account.password,
    ])
      walk(node, []);
    if (w) {
      const rows = new Set(
        [w.information, w.vouchers, w.reports, w.masters]
          .flatMap((section) => section.items)
          .map(toRaw),
      );
      for (const [row, target] of w.targets ?? [])
        if (rows.has(toRaw(row))) collect(target);
      collect(w.manageReports);
    }
    const roots = new Set(modelCollections(model()).map(toRaw));
    // Explicit finite target edges attach off-page records after actual ownership
    // has been indexed. An already owned record never moves to another root.
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!;
      if (target.record && roots.has(toRaw(target.collection)))
        walk(target.record, [target.collection]);
    }
    return result;
  });
  const paths = () => structuralPaths.value;
  function ancestors(node: Node) {
    return paths().get(toRaw(node)) ?? [];
  }
  const same = (a: object, b: object) => toRaw(a) === toRaw(b);
  function readable(node: Node): boolean {
    if (!ready.value || !paths().has(toRaw(node))) return false;
    const chain = [...ancestors(node), node];
    return (
      chain.every((member) => member.readable !== false) &&
      (model().session.state !== "password-required" ||
        chain.some((member) => same(member, model().account.password)))
    );
  }
  function writable(node: Node): boolean {
    return (
      readable(node) &&
      ![...ancestors(node), node].some(
        (member) => !isCollection(member) && member.readOnly,
      )
    );
  }
  function operations(node: Node): Record<string, Operation> {
    if (same(node, model().authentication.form))
      return model().authentication.operations;
    if (same(node, model().account.password))
      return {
        ...model().account.password.operations,
        changePassword: model().account.operations.changePassword,
      };
    if (!isCollection(node) && node.kind === "object")
      return {
        ...node.document?.operations,
        ...node.workflow?.operations,
        ...node.processing?.operations,
        ...node.batch?.operations,
        ...node.report?.operations,
        ...node.output?.operations,
        ...node.operations,
      };
    return "operations" in node
      ? (node.operations as Record<string, Operation>)
      : "load" in node && node.load
        ? { load: node.load }
        : {};
  }
  function allowed(node: Node, action: string, publicAuth = false): boolean {
    const automatic =
      isCollection(node) &&
      ((action === "print" && node.printTemple) ||
        (action === "itemPrint" && node.itemPrintTemple));
    if (!operations(node)[action] && !automatic) return false;
    if (publicAuth)
      return (
        same(node, model().authentication.form) &&
        node.readable !== false &&
        ((model().session.state === "anonymous" &&
          ["signIn", "recover"].includes(action)) ||
          (model().session.state === "recovering" && action === "recover"))
      );
    return readable(node);
  }
  function available(node: Node, action: string, publicAuth = false) {
    return (
      allowed(node, action, publicAuth) && !operations(node)[action]?.disabled
    );
  }
  function editable(node: Node) {
    return allowed(node, "update");
  }
  function handleable(node: ObjectNode) {
    if (
      node.processing &&
      Object.keys(node.processing.operations).some((action) =>
        allowed(node, action),
      )
    )
      return true;
    return (
      [node.document, node.workflow, node.batch, node.report].some(
        (capability) =>
          Object.keys(capability?.operations ?? {}).some((action) =>
            available(node, action),
          ),
      ) ||
      (!!node.output &&
        (available(node, "confirmPrinted") ||
          available(node, "confirmNotPrinted")))
    );
  }
  async function execute(
    key: object,
    op: Operation,
    valid: () => boolean,
    options: { propagate?: boolean; query?: Collection; target?: Node } = {},
  ) {
    key = toRaw(key);
    if (op.disabled || busy.value.has(key) || !valid()) return;
    const start = epoch,
      owner = scope.value,
      execution = Symbol(),
      messages = feedback.start(),
      queryViews = queries.value,
      collection = options.query && toRaw(options.query),
      previous = collection && queryViews.get(collection),
      retryPage = collection?.page,
      canRetry = options.query && retryGuard(options.query),
      stillPresent = feedback.capture(options.target),
      reading: QueryView | undefined = collection && {
        state: "loading",
        page: previous?.page ?? collection.page,
      },
      current = () =>
        start === epoch && owner === scope.value && valid() && stillPresent();
    if (collection && reading) queryViews.set(collection, reading);
    executions.set(key, execution);
    feedbackExecutions.add(execution);
    busy.value.add(key);
    try {
      await op.run();
      if (collection && current())
        queryViews.set(collection, { state: "success", page: collection.page });
    } catch (cause) {
      if (current()) {
        const notice = feedback.specific(
          messages,
          options.target,
          execution,
          !!collection,
        );
        if (collection && reading && canRetry && retryPage !== undefined) {
          if (notice) feedback.place(notice, collection, true);
          queryViews.set(collection, {
            state: "failure",
            page: reading.page,
            retryPage,
            canRetry,
            error: notice ? `查询失败：${notice.text}` : "查询失败，请重试。",
          });
        } else if (notice) {
          feedback.place(notice, notice.target ?? options.target ?? null);
        } else {
          feedback.fail(options.target ?? null);
        }
      }
      if (options.propagate) throw cause;
    } finally {
      if (
        !current() &&
        (!executions.has(key) || executions.get(key) === execution)
      )
        feedback.discard(messages, options.target, execution);
      feedbackExecutions.delete(execution);
      if (collection && queryViews.get(collection) === reading) {
        if (previous) queryViews.set(collection, previous);
        else queryViews.delete(collection);
      }
      if (executions.get(key) === execution) {
        executions.delete(key);
        busy.value.delete(key);
      }
    }
  }
  async function run(node: Node, action: string, publicAuth = false) {
    const op = operations(node)[action],
      owner = scope.value,
      start = epoch,
      identity = "identity" in node ? node.identity : node.key;
    const valid = () =>
      operations(node)[action] === op &&
      ("identity" in node ? node.identity : node.key) === identity &&
      allowed(node, action, publicAuth);
    if (op)
      await execute(
        node,
        {
          get disabled() {
            return op.disabled;
          },
          async run() {
            await op.run();
            if (
              start === epoch &&
              owner === scope.value &&
              valid() &&
              isCollection(node) &&
              node.report &&
              ["get", "query"].includes(action)
            )
              reportViews.set(toRaw(node), { left: 0, top: 0 });
          },
        },
        valid,
        {
          propagate: action === "load",
          target: publicAuth ? undefined : node,
          query: isCollection(node) && action === "query" ? node : undefined,
        },
      );
  }
  async function runAccount(action: "signOut" | "changePassword" = "signOut") {
    const account = model().account,
      op = account.operations[action];
    await execute(
      account,
      op,
      () =>
        ready.value &&
        model().account === account &&
        account.operations[action] === op,
    );
  }
  function interactable(node: InteractionNode) {
    return writable(node);
  }
  async function runInteraction(
    node: InteractionNode,
    operation: Operation,
    valid: () => boolean,
  ) {
    await execute(node, operation, () => interactable(node) && valid(), {
      target: node,
    });
  }
  function downloadable(node: InteractionNode) {
    return readable(node);
  }
  async function runDownload(
    node: InteractionNode,
    operation: Operation,
    valid: () => boolean,
  ) {
    await execute(node, operation, () => downloadable(node) && valid(), {
      target: node,
    });
  }
  async function runWorkbench(once = false) {
    const w = model().workbench;
    if (!w?.load) return;
    const key = toRaw(w),
      loaded = workbenchLoads.get(key) ?? new Set<string>();
    if (once && loaded.has(scope.value)) return;
    if (
      !ready.value ||
      ![w.information, w.vouchers, w.reports, w.masters].some(readable) ||
      w.load.disabled
    )
      return;
    loaded.add(scope.value);
    workbenchLoads.set(key, loaded);
    const operation = w.load;
    await execute(
      w,
      operation,
      () =>
        ready.value &&
        model().workbench === w &&
        w.load === operation &&
        [w.information, w.vouchers, w.reports, w.masters].some(readable),
    );
  }
  function invalidate(scopeChanged = false) {
    epoch++;
    feedback.clear();
    if (scopeChanged) {
      queries.value = shallowReactive(new WeakMap());
      reportViews.clear();
      executions.clear();
      busy.value.clear();
    }
    for (const node of reportViews.keys())
      if (!paths().has(node) || !readable(node as Node))
        reportViews.delete(node);
  }
  return {
    model,
    scope,
    ready,
    busy,
    feedback,
    queryView: (collection) => queries.value.get(toRaw(collection)),
    reportViews,
    contains: (node) => paths().has(toRaw(node)),
    ancestors,
    readable,
    writable,
    editable,
    handleable,
    independent: (node) =>
      ancestors(node).length === 0 ||
      (!isCollection(node) && node.kind === "object" && editable(node)),
    allowed,
    operations,
    available,
    run,
    interactable,
    runInteraction,
    downloadable,
    runDownload,
    runAccount,
    runWorkbench,
    invalidate,
  };
}
export const directRuntimeKey: InjectionKey<DirectRuntime> = Symbol(
  "direct-business-model",
);
export const labels: Record<string, string> = {
  get: "刷新",
  update: "保存",
  delete: "删除",
  reconcile: "核对结果",
  remove: "移除",
  calculate: "计算",
  stageAttachments: "上传附件",
  withdraw: "撤回",
  reverse: "冲销",
  start: "启动",
  advance: "推进",
  createChild: "新增",
  approveChild: "批准子项",
  rejectChild: "拒绝子项",
  retryChild: "重试子项",
  cancelChild: "取消子项",
  openVoucher: "查看单据",
  audit: "查看记录",
  cancel: "取消",
  process: "处理",
  publish: "发布",
  restore: "恢复",
  validate: "校验",
  run: "运行",
  stop: "停止",
  import: "导入",
  query: "查询",
  create: "新增",
  export: "导出",
  signIn: "登录",
  recover: "恢复会话",
  signOut: "退出",
  changePassword: "修改密码",
  submit: "提交",
  approve: "审批",
  enable: "启用",
  disable: "停用",
  clone: "克隆",
  send: "发送",
  unapprove: "取消审批",
  complete: "完成",
  uncomplete: "取消完成",
  void: "作废",
  unvoid: "取消作废",
  executeBatch: "执行批次",
  preview: "预览",
  print: "打印",
  itemPrint: "打印",
  confirmPrinted: "确认已打印",
  confirmNotPrinted: "确认未打印",
};
