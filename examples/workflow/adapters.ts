import { reactive } from "vue";
import {
  defineWorkflow,
  defineVoucher,
  type WorkflowAdapter,
  type WorkflowAttempt,
  type WorkflowAction,
  type WorkflowInstance,
  type VoucherSnapshot,
  type VoucherAdapter,
} from "@zerp/ui";
export const controls = reactive({ scenario: "success", reads: "success" });
type Target = { entity: "receipt" };
export type VoucherRef = { id: string };
type Attempt = WorkflowAttempt<string, string, string, Target, VoucherRef>;
type Event = {
  event: string;
  request: Attempt | null;
  result: "applied" | "not-applied";
};
type Instance = WorkflowInstance<string, string, string, Target, VoucherRef>;
const copy = <T>(value: T): T => structuredClone(value);
const instances = new Map<string, Instance>();
const audits = new Map<string, Event[]>();
let failRefresh = false;
const vouchers = new Map<string, Snap>();
type Snap = VoucherSnapshot<
  { name: string; amount: string },
  string,
  string,
  { id: string },
  string,
  string,
  string
>;
function doc(id: string): Snap {
  return {
    identity: {
      voucher: id,
      revision: "r1",
      submission: { id: `submission-${id}` },
    },
    number: id,
    handler: "合成经办人",
    state: "open",
    values: { name: "合成单据正文", amount: "9007199254740993.0100" },
    owner: "synthetic",
    attachments: [],
    eligible: { edit: true },
  };
}
function key(scope: string, id: string) {
  return JSON.stringify([scope, id]);
}
function get(scope: string, id: string) {
  const k = key(scope, id);
  if (!instances.has(k)) {
    vouchers.set(key(scope, `${id}-root`), doc(`${id}-root`));
    instances.set(k, {
      identity: id,
      label: `合成${id}`,
      nodes: [
        {
          identity: "root",
          revision: "r1",
          label: "根节点",
          state: "待处理",
          voucher: { id: `${id}-root` },
          eligible: ["OPEN_VOUCHER", "CREATE_CHILD"],
          targets: [
            {
              key: "receipt",
              label: "合成收据",
              identity: { entity: "receipt" },
            },
            {
              key: "hidden",
              label: "未授权目标",
              identity: { entity: "receipt" },
            },
          ],
        },
      ],
    });
    // A historical similar action is deliberately insufficient for reconciliation.
    audits.set(k, [
      { event: "历史批准下级", request: null, result: "applied" },
    ]);
  }
  return instances.get(k)!;
}
const adapter: WorkflowAdapter<
  string,
  string,
  string,
  Target,
  VoucherRef,
  Event
> = {
  async list({ scope, keyword }) {
    if (failRefresh) {
      failRefresh = false;
      throw new Error("合成刷新失败");
    }
    if (controls.reads === "failure") throw new Error("合成查询失败");
    const items =
      controls.reads === "empty"
        ? []
        : ["流程一", "流程二"]
            .filter((id) => id.includes(keyword))
            .map((id) => {
              get(scope, id);
              return { identity: id, label: id };
            });
    return { items, total: items.length };
  },
  async get({ scope, identity }) {
    return copy(get(scope, identity));
  },
  async audit({ scope, identity }) {
    get(scope, identity);
    return copy(audits.get(key(scope, identity))!);
  },
  async act(attempt) {
    const instance = get(attempt.scope, attempt.instance);
    const node = instance.nodes.find((n) => n.identity === attempt.node);
    // This mock backend rechecks facts independently of the runtime's presentation.
    if (
      !node ||
      node.revision !== attempt.revision ||
      !node.eligible.includes(attempt.operation)
    )
      return { status: "failure", message: "合成资格或修订冲突" };
    if (
      attempt.operation === "CREATE_CHILD" &&
      attempt.target.entity !== "receipt"
    )
      return { status: "failure", message: "合成目标不合格" };
    if (controls.scenario === "conflict")
      return { status: "failure", message: "合成修订冲突" };
    if (controls.scenario === "no-evidence") return { status: "unknown" };
    const applied = controls.scenario !== "not-applied";
    if (applied) {
      if (attempt.operation === "CREATE_CHILD") {
        const id = `${attempt.instance}-child`;
        vouchers.set(key(attempt.scope, id), doc(id));
        instance.nodes = [
          ...instance.nodes,
          {
            identity: "child",
            revision: "r1",
            label: "下级节点",
            state: "待处理",
            voucher: { id },
            eligible: [
              "OPEN_VOUCHER",
              "APPROVE_CHILD",
              "REJECT_CHILD",
              "RETRY_CHILD",
              "CANCEL_CHILD",
            ],
            targets: [],
          },
        ];
        node.eligible = ["OPEN_VOUCHER"];
      } else if (attempt.operation !== "OPEN_VOUCHER") {
        node.state = (
          {
            APPROVE_CHILD: "已批准",
            REJECT_CHILD: "已驳回",
            RETRY_CHILD: "已重试",
            CANCEL_CHILD: "已取消",
          } satisfies Record<
            Exclude<WorkflowAction, "OPEN_VOUCHER" | "CREATE_CHILD">,
            string
          >
        )[attempt.operation];
        node.eligible = ["OPEN_VOUCHER"];
      }
      node.revision += "+1";
    }
    audits.get(key(attempt.scope, attempt.instance))!.push({
      event: `${attempt.operation} · ${attempt.id}`,
      request: copy(attempt),
      result: applied ? "applied" : "not-applied",
    });
    if (controls.scenario === "refresh-failure") failRefresh = true;
    return {
      status: ["unknown", "not-applied"].includes(controls.scenario)
        ? "unknown"
        : "success",
    };
  },
};
export const workflow = defineWorkflow({
  resource: "synthetic-workflow",
  title: "合成流程运行时",
  adapter,
  auditColumns: [{ key: "event", label: "事件" }],
  async reconcile(attempt) {
    const events = await adapter.audit({
      scope: attempt.scope,
      identity: attempt.instance,
    });
    const exact = events.find(
      (event) =>
        event.request &&
        JSON.stringify(event.request) === JSON.stringify(attempt),
    );
    return exact
      ? { status: exact.result, attemptId: attempt.id, evidence: exact }
      : { status: "unknown" };
  },
});
const voucherAdapter: VoucherAdapter<
  { name: string; amount: string },
  string,
  string,
  { id: string },
  string,
  string,
  string,
  { event: string }
> = {
  async list({ scope }) {
    return {
      items: [...vouchers.entries()]
        .filter(([k]) => JSON.parse(k)[0] === scope)
        .map(([, s]) => ({
          identity: s.identity,
          number: s.number,
          handler: s.handler,
        })),
      total: [...vouchers.keys()].filter((k) => JSON.parse(k)[0] === scope)
        .length,
    };
  },
  async get({ scope, identity }) {
    const current = vouchers.get(key(scope, identity.voucher));
    if (!current) throw new Error("合成单据不存在");
    return {
      current: copy(current),
      history: [],
      audit: [{ event: "合成单据读取" }],
    };
  },
  async submit(attempt) {
    const current = vouchers.get(key(attempt.scope, attempt.identity.voucher));
    if (!current || current.identity.revision !== attempt.identity.revision)
      return { status: "failure", message: "合成单据修订冲突" };
    current.values = copy(attempt.input);
    current.identity = {
      ...current.identity,
      revision: current.identity.revision + "+1",
      submission: { id: attempt.id },
    };
    return { status: "success" };
  },
};
export const voucherDefinition = defineVoucher({
  protocol: "submission",
  resource: "synthetic-voucher",
  title: "流程单据正文",
  fields: [
    { key: "name", type: "text", label: "名称" },
    { key: "amount", type: "decimal", label: "精确金额" },
  ],
  auditColumns: [{ key: "event", label: "事件" }],
  adapter: voucherAdapter,
});

// The host limits the voucher runtime to the route's exact target identity.
export function voucherFor(id: string): typeof voucherDefinition {
  return {
    ...voucherDefinition,
    adapter: {
      ...voucherAdapter,
      async list(input) {
        const rows = await voucherAdapter.list(input);
        const items = rows.items.filter((row) => row.identity.voucher === id);
        return { items, total: items.length };
      },
      async get(input) {
        if (input.identity.voucher !== id) throw new Error("合成路由身份不符");
        return voucherAdapter.get(input);
      },
    },
  };
}
