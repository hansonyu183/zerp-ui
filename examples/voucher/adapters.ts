import {
  defineVoucher,
  defineConfiguration,
  type VoucherAdapter,
  type VoucherSnapshot,
  type VoucherAttempt,
  type VoucherStageAttempt,
  type VoucherReconciliation,
  type WriteResult,
  type ReconcileResult,
} from "@zerp/ui";
export type Entry = {
  name: string;
  entry: {
    amount: string;
    source: { id: string; label: string; snapshot?: unknown } | null;
    rows: { id: string; name: string; children: { amount: string }[] }[];
  };
};
export type Submission = { id: string; adopted: string };
type Snapshot = VoucherSnapshot<
  Entry,
  string,
  string,
  Submission,
  string,
  string,
  string
>;
type Attempt =
  | VoucherAttempt<Entry, string, string, Submission, string, string>
  | VoucherStageAttempt<string, string, Submission, string, string>;
export type Scenario =
  | "success"
  | "conflict"
  | "unknown-applied"
  | "unknown-not-applied"
  | "no-evidence"
  | "refresh-failure"
  | "stage-unknown";
const copy = <T>(value: T): T => structuredClone(value);
export function sample(
  kind: "ordinary" | "opening" | "system",
  scenario: () => Scenario,
) {
  const initial: Snapshot = {
    identity: {
      voucher: `synthetic-${kind}`,
      revision: "r1",
      submission: { id: "submission-v1", adopted: "immutable-original" },
    },
    number: `SYN-${kind}`,
    handler: "合成经办人",
    state: "open",
    owner: `owner-${kind}`,
    attachments: [],
    values: {
      name: `合成${kind === "opening" ? "期初" : kind === "system" ? "系统单据" : "录入"}`,
      entry: {
        amount: "9007199254740993.0100",
        source: {
          id: "old-source",
          label: "历史来源",
          snapshot: { revision: "source-r1", rate: "0.0100" },
        },
        rows: [],
      },
    },
    eligible:
      kind === "system" ? {} : { edit: true, approve: true, clone: true },
  };
  const history = copy(initial),
    records = [copy(initial)],
    audit: { event: string }[] = [];
  const receipts = new Map<string, { attempt: Attempt; handle?: string }>();
  const files = new Map<string, { file: File; owner: string }>();
  let failRead = false;
  const find = (id: string) => records.find((s) => s.identity.voucher === id)!;
  function apply(a: Exclude<Attempt, { operation: "stage" }>) {
    if (a.operation === "submit") {
      const previous = records.findIndex(
        (s) => s.identity.voucher === a.identity.voucher,
      );
      const next: Snapshot = {
        ...copy(initial),
        identity: {
          voucher: a.identity.voucher,
          revision: `r-${a.id}`,
          submission: {
            id: `submission-${a.id}`,
            adopted: a.input.entry.source?.id ?? "none",
          },
        },
        number:
          previous < 0 ? `SYN-${records.length + 1}` : records[previous].number,
        values: copy(a.input),
        attachments: a.attachments.map((handle) => ({
          handle,
          label: files.get(handle)?.file.name ?? handle,
        })),
      };
      if (previous < 0) records.push(next);
      else records[previous] = next;
    } else {
      const item = find(a.identity.voucher);
      item.state = "approved";
      item.eligible = { clone: true };
    }
    audit.push({
      event: `${a.operation === "submit" ? "提交" : "审批"} · ${a.id}`,
    });
  }
  async function write(
    a: Exclude<Attempt, { operation: "stage" }>,
  ): Promise<WriteResult> {
    if (scenario() === "conflict")
      return { status: "failure", message: "合成修订冲突" };
    const current = records.find(
      (s) => s.identity.voucher === a.identity.voucher,
    );
    if (
      current &&
      (current.identity.revision !== a.identity.revision ||
        JSON.stringify(current.identity.submission) !==
          JSON.stringify(a.identity.submission))
    )
      return { status: "failure", message: "原身份已过期" };
    if (scenario() === "unknown-not-applied" || scenario() === "no-evidence")
      return { status: "unknown" };
    apply(a);
    receipts.set(a.id, { attempt: copy(a) });
    if (scenario() === "unknown-applied") return { status: "unknown" };
    failRead = scenario() === "refresh-failure";
    return { status: "success" };
  }
  const adapter: VoucherAdapter<
    Entry,
    string,
    string,
    Submission,
    string,
    string,
    string,
    { event: string }
  > = {
    list: async ({ page, pageSize }) => {
      if (failRead) {
        failRead = false;
        throw new Error("合成刷新失败");
      }
      return {
        items: records
          .slice((page - 1) * pageSize, page * pageSize)
          .map((s) => ({
            identity: copy(s.identity),
            number: s.number,
            handler: s.handler,
          })),
        total: records.length,
      };
    },
    get: async ({ identity }) => ({
      current: copy(find(identity.voucher)),
      history: [copy(history)],
      audit: copy(audit),
    }),
    ...(kind === "system"
      ? {}
      : {
          empty: () => ({
            ...copy(initial),
            identity: {
              voucher: crypto.randomUUID(),
              revision: "r0",
              submission: null,
            },
            number: "新 Draft",
            attachments: [],
          }),
          clone: ({ source }: { source: Snapshot }) => ({
            ...copy(source),
            identity: {
              voucher: crypto.randomUUID(),
              revision: "r0",
              submission: null,
            },
            number: "克隆 Draft",
            state: "open",
            eligible: { edit: true, approve: true, clone: true },
            attachments: [],
          }),
        }),
    submit: write,
    ...(kind === "system" ? {} : { approve: write }),
    attachments: {
      validate: (file) => (file.size > 4096 ? "合成文件最大 4 KiB" : undefined),
      stage: async (a) => {
        const handle = `stage-${a.id}`;
        files.set(handle, { file: a.file, owner: a.owner });
        receipts.set(a.id, { attempt: { ...a, file: a.file }, handle });
        return scenario() === "stage-unknown"
          ? { status: "unknown" }
          : { status: "success", handle };
      },
      read: async ({ handle, owner }) => {
        const item = files.get(handle);
        if (!item || item.owner !== owner) throw new Error("附件 Owner 不匹配");
        return { content: item.file, filename: item.file.name };
      },
    },
  };
  return defineVoucher({
    protocol: "submission",
    resource: `synthetic-${kind}`,
    title: `合成单据 · ${kind}`,
    fields: [{ key: "name", label: "名称", type: "text", required: true }],
    auditColumns: [{ key: "event", label: "事件" }],
    adapter,
    reconcile: async (
      a,
    ): Promise<
      VoucherReconciliation<string, { receipt: string; revision: string }>
    > => {
      // Simulated authoritative audit, tied to original identity/revision/submission and input.
      if (scenario() === "no-evidence") return { status: "unknown" };
      const receipt = receipts.get(a.id);
      if (!receipt)
        return scenario() === "unknown-not-applied"
          ? {
              status: "not-applied",
              operation: a.operation === "stage" ? "stage" : "business",
              attemptId: a.id,
              evidence: {
                receipt: `not-applied-${a.id}`,
                revision: a.identity.revision,
              },
            }
          : { status: "unknown" };
      if (JSON.stringify(receipt.attempt) !== JSON.stringify(a))
        return { status: "unknown" };
      const evidence = { receipt: a.id, revision: a.identity.revision };
      return a.operation === "stage"
        ? {
            status: "applied",
            operation: "stage",
            attemptId: a.id,
            evidence,
            handle: receipt.handle!,
          }
        : {
            status: "applied",
            operation: "business",
            attemptId: a.id,
            evidence,
          };
    },
  });
}
export function scriptSample(scenario: () => Scenario) {
  let values = { source: "return 'synthetic';" },
    revision = "script-r1";
  const receipts = new Map<string, string>();
  return defineConfiguration({
    resource: "synthetic-script",
    title: "合成独立脚本",
    fields: [{ key: "source", label: "脚本正文", type: "textarea" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "脚本" }],
    identity: () => ({ script: "script-one", revision }),
    adapter: {
      query: async () => ({ items: [{ name: "计算脚本" }], total: 1 }),
      get: async () => ({
        values: copy(values),
        identity: { script: "script-one", revision },
        writable: true,
      }),
      save: async (a) => {
        if (a.identity?.revision !== revision)
          return { status: "failure", message: "脚本修订冲突" };
        if (
          scenario() === "unknown-not-applied" ||
          scenario() === "no-evidence"
        )
          return { status: "unknown" };
        values = copy(a.input);
        revision = a.id;
        receipts.set(a.id, JSON.stringify(a));
        return {
          status: scenario() === "unknown-applied" ? "unknown" : "success",
        };
      },
    },
    reconcile: async (a): Promise<ReconcileResult<{ receipt: string }>> =>
      receipts.get(a.id) === JSON.stringify(a)
        ? { status: "applied", attemptId: a.id, evidence: { receipt: a.id } }
        : scenario() === "unknown-not-applied"
          ? {
              status: "not-applied",
              attemptId: a.id,
              evidence: { receipt: a.id },
            }
          : { status: "unknown" },
  });
}
