import { operationLabels } from "@zerp/ui";
import type {
  OperationAction,
  OperationDefinition,
  OperationIntent,
  OperationJournal,
  OperationPreview,
  OperationReceipt,
  OperationRequest,
  OperationOwner,
} from "@zerp/ui";
export type SyntheticModel = {
  [A in OperationAction]: {
    input: { note: string } & (A extends "create" | "edit"
      ? { rows: readonly { key: string; quantity: string }[] }
      : object);
    preview: OperationPreview & { action: A };
    evidence: { action: A; receipt: string } & (A extends
      "create" | "edit" | "delete"
      ? { result: { voucher: string | null; deleted: boolean } }
      : object);
  };
};
export type Identity = { voucher: string | null };
export type Baseline = { revision: string; configuration: string };
export type SyntheticRequest = OperationRequest<
  SyntheticModel,
  Identity,
  Baseline
>;
export type SyntheticJournal = OperationJournal<
  SyntheticModel,
  Identity,
  Baseline
>;
export type Scenario =
  | "success"
  | "unknown"
  | "not-applied"
  | "wrong-proof"
  | "refresh-failure"
  | "save-failure"
  | "seal-failure"
  | "no-evidence"
  | "verification-failure"
  | "cleanup-failure";
// Cleanup failure is injected by the consumer persistence port.
export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function operationBinding(request: SyntheticRequest) {
  const base = {
    action: request.action,
    owner: request.owner,
    identity: request.identity,
    input: request.input,
    concurrency: request.concurrency,
    preview: request.preview,
  };
  return JSON.stringify(base);
}
export function decodeJournal(value: unknown): SyntheticJournal {
  const record = value as SyntheticJournal,
    r = record?.request;
  const fail = () => {
    throw new Error("合成原请求记录损坏，不能当作空槽。");
  };
  if (
    !r ||
    !r.owner ||
    ![
      r.owner.scope,
      r.owner.operator,
      r.owner.resource,
      r.requestId,
      r.binding,
      r.input?.note,
      r.concurrency?.revision,
      r.concurrency?.configuration,
    ].every((v) => typeof v === "string") ||
    !r.requestId ||
    !r.binding ||
    !Object.hasOwn(operationLabels, r.action) ||
    !r.identity ||
    (r.action === "create"
      ? r.identity.voucher !== null
      : typeof r.identity.voucher !== "string") ||
    ((r.action === "create" || r.action === "edit") &&
      (!Array.isArray(r.input.rows) ||
        !r.input.rows.every(
          (row) =>
            typeof row.key === "string" && typeof row.quantity === "string",
        ))) ||
    r.preview?.action !== r.action ||
    typeof r.preview.title !== "string" ||
    !Array.isArray(r.preview.sections)
  )
    fail();
  for (const section of r.preview.sections) {
    if (
      typeof section.key !== "string" ||
      typeof section.title !== "string" ||
      !Array.isArray(section.rows)
    )
      fail();
    for (const row of section.rows) {
      if (typeof row.key !== "string" || !Array.isArray(row.fields)) fail();
      for (const field of row.fields) {
        if (
          typeof field.label !== "string" ||
          (field.value !== null &&
            !["string", "boolean", "number"].includes(typeof field.value))
        )
          fail();
      }
    }
  }
  if (r.binding !== operationBinding(r)) fail();
  const proof = record.receipt;
  if (
    proof &&
    (!proof.owner ||
      proof.owner.scope !== r.owner.scope ||
      proof.owner.operator !== r.owner.operator ||
      proof.owner.resource !== r.owner.resource ||
      proof.action !== r.action ||
      proof.requestId !== r.requestId ||
      proof.binding !== r.binding ||
      proof.evidence?.action !== r.action ||
      proof.evidence?.receipt !== `authority:${r.requestId}` ||
      !["applied", "not-applied"].includes(proof.status) ||
      (proof.status === "not-applied" && typeof proof.sealed !== "boolean"))
  )
    fail();
  if (
    proof &&
    ["create", "edit", "delete"].includes(proof.action) &&
    (!("result" in proof.evidence) ||
      (proof.status === "applied" &&
        (typeof proof.evidence.result.voucher !== "string" ||
          !proof.evidence.result.voucher)) ||
      (proof.evidence.result.voucher !== null &&
        typeof proof.evidence.result.voucher !== "string") ||
      typeof proof.evidence.result.deleted !== "boolean")
  )
    fail();
  if (
    record.refreshed !== undefined &&
    (record.refreshed !== true ||
      !proof ||
      (proof.status === "not-applied" && !proof.sealed))
  )
    fail();
  if (
    record.completed !== undefined &&
    (record.completed !== true || !record.refreshed)
  )
    fail();
  return structuredClone(record);
}
export function synthetic(
  storage: Store,
  scenario: () => Scenario,
  log: (message: string) => void = () => {},
) {
  const key = (owner: OperationOwner) =>
    `SYNTHETIC-OPERATIONS-wipe-me:${JSON.stringify([owner.scope, owner.operator, owner.resource])}`;
  const read = (
    owner: OperationOwner,
    requestId?: string,
  ): SyntheticJournal | null => {
    const raw = storage.getItem(
      requestId ? `${key(owner)}:request:${requestId}` : key(owner),
    );
    if (!raw) return null;
    return decodeJournal(JSON.parse(raw));
  };
  const receipt = (
    request: SyntheticRequest,
    status: "applied" | "not-applied",
    sealed = false,
  ): OperationReceipt<SyntheticModel> =>
    ({
      action: request.action,
      owner: request.owner,
      requestId: request.requestId,
      binding: request.binding,
      evidence: {
        action: request.action,
        receipt: `authority:${request.requestId}`,
        ...(["create", "edit", "delete"].includes(request.action)
          ? {
              result: {
                voucher:
                  request.identity.voucher ??
                  (status === "applied"
                    ? `SYN-created-${request.requestId}`
                    : null),
                deleted: request.action === "delete" && status === "applied",
              },
            }
          : {}),
      },
      ...(status === "applied" ? { status } : { status, sealed }),
    }) as OperationReceipt<SyntheticModel>;
  function storedProof(
    request: SyntheticRequest,
  ): OperationReceipt<SyntheticModel> | null {
    const raw = storage.getItem(
      `SYNTHETIC-OPERATIONS-authority:${request.requestId}`,
    );
    if (!raw) return null;
    const proof = JSON.parse(raw) as OperationReceipt<SyntheticModel>;
    if (
      proof.binding !== request.binding ||
      request.binding !== operationBinding(request)
    )
      throw new Error("合成原请求内容冲突");
    return proof;
  }
  const definition: OperationDefinition<SyntheticModel, Identity, Baseline> = {
    protocol: "operation",
    persistence: {
      async load(owner, requestId) {
        return read(owner, requestId);
      },
      async save(record, expectedId) {
        if (scenario() === "save-failure") throw new Error("合成存储不可写");
        const existing = read(record.request.owner);
        if (
          (existing && !existing.completed
            ? existing.request.requestId
            : null) !== expectedId
        )
          throw new Error("原请求槽已占用或发生并发变化");
        if (expectedId !== null && existing) {
          if (existing.request.binding !== record.request.binding)
            throw new Error("拒绝改写原请求完整输入");
          if (
            existing.receipt?.status === "applied" &&
            record.receipt?.status !== "applied"
          )
            throw new Error("拒绝回退已应用回执");
          if (
            existing.receipt?.status === "not-applied" &&
            existing.receipt.sealed &&
            (record.receipt?.status !== "not-applied" || !record.receipt.sealed)
          )
            throw new Error("拒绝回退已封存回执");
          if (existing.refreshed && !record.refreshed)
            throw new Error("拒绝回退读取完成记录");
        }
        storage.setItem(key(record.request.owner), JSON.stringify(record));
        storage.setItem(
          `${key(record.request.owner)}:request:${record.request.requestId}`,
          JSON.stringify(record),
        );
        log(
          `save:${record.request.requestId}:${record.receipt?.status ?? "unresolved"}`,
        );
      },
      async remove(owner, expectedId) {
        const existing = read(owner);
        if (existing?.request.requestId !== expectedId || !existing.refreshed)
          throw new Error("拒绝清理另一原请求或未完成读取的记录");
        const completed = decodeJournal({ ...existing, completed: true });
        storage.setItem(key(owner), JSON.stringify(completed));
        storage.setItem(
          `${key(owner)}:request:${expectedId}`,
          JSON.stringify(completed),
        );
        log(`remove:${expectedId}`);
      },
    },
    adapter: {
      async prepare(intent: OperationIntent<SyntheticModel, Identity>) {
        const base = {
          ...structuredClone(intent),
          concurrency: { revision: "r7", configuration: "c3" },
          preview: {
            action: intent.action,
            title: "合成完整办理预览",
            sections: [
              {
                key: "header",
                title: "单据头",
                rows: [
                  {
                    key: "header",
                    fields: [
                      {
                        label: "单号",
                        value: intent.identity.voucher ?? "待创建",
                      },
                      { label: "办理原输入", value: intent.input.note },
                      { label: "并发基线", value: "r7 / c3" },
                    ],
                  },
                ],
              },
              {
                key: "rows",
                title: "全部明细与影响",
                rows: [
                  {
                    key: "one",
                    fields: [
                      { label: "精确金额", value: "9007199254740993.0100" },
                      {
                        label: "业务影响",
                        value:
                          "合成权威预览：由消费者决定业务逆转，不在库内计算",
                      },
                    ],
                  },
                  {
                    key: "two",
                    fields: [
                      { label: "空文本", value: "" },
                      { label: "缺失", value: null },
                      { label: "零值", value: 0 },
                      { label: "布尔", value: false },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const request = {
          ...base,
          requestId: crypto.randomUUID(),
          binding: "",
        } as SyntheticRequest;
        log(`prepare:${request.requestId}`);
        if ("rows" in intent.input) {
          base.preview.sections.push({
            key: "content",
            title: "内容明细",
            rows: intent.input.rows.map((row) => ({
              key: row.key,
              fields: [{ label: "数量", value: row.quantity }],
            })),
          });
        }
        return { ...request, binding: operationBinding(request) };
      },
      acceptsPreparation(intent, prepared) {
        return (
          intent.action === prepared.action &&
          intent.identity.voucher === prepared.identity.voucher &&
          intent.input.note === prepared.input.note &&
          JSON.stringify(intent.input) === JSON.stringify(prepared.input) &&
          prepared.binding === operationBinding(prepared)
        );
      },
      async execute(request) {
        log(`execute:${request.requestId}:${request.owner.operator}`);
        // Synthetic authority is durable across an actual page reload; no business API is called.
        const proof =
          storedProof(request) ??
          receipt(
            request,
            scenario() === "not-applied" || scenario() === "seal-failure"
              ? "not-applied"
              : "applied",
          );
        storage.setItem(
          `SYNTHETIC-OPERATIONS-authority:${request.requestId}`,
          JSON.stringify(proof),
        );
        if (scenario() === "unknown" || scenario() === "wrong-proof")
          return { status: "unknown" };
        return proof;
      },
      async reconcile(request) {
        log(`reconcile:${request.requestId}:${request.owner.operator}`);
        if (scenario() === "no-evidence") return { status: "unknown" };
        if (scenario() === "verification-failure")
          throw new Error("合成核实连接失败");
        let proof = storedProof(request);
        if (!proof) {
          // Simulate an authoritative confirmation of the full original request,
          // durably recording its result; a missing GET record alone is no proof.
          proof = receipt(request, "not-applied");
          storage.setItem(
            `SYNTHETIC-OPERATIONS-authority:${request.requestId}`,
            JSON.stringify(proof),
          );
        }
        return scenario() === "wrong-proof"
          ? { ...proof, binding: "unrelated-payload" }
          : proof;
      },
      async seal(request) {
        log(`seal:${request.requestId}`);
        if (scenario() === "seal-failure")
          throw new Error("合成封存失败，原请求仍锁定");
        const existing = storedProof(request);
        const proof =
          existing?.status === "applied"
            ? existing
            : receipt(request, "not-applied", true);
        storage.setItem(
          `SYNTHETIC-OPERATIONS-authority:${request.requestId}`,
          JSON.stringify(proof),
        );
        return proof;
      },
      async refresh({ request, receipt }) {
        const result =
          "result" in receipt.evidence ? receipt.evidence.result : null;
        log(
          `refresh:${request.owner.operator}:${result?.voucher ?? request.identity.voucher}`,
        );
        if (scenario() === "refresh-failure")
          throw new Error("合成刷新失败；只允许重读，不再执行");
        if (result && receipt.status === "applied")
          log(
            `${result.deleted ? "deleted" : "content"}:${result.voucher}:${request.input.note}`,
          );
      },
      accepts(request, proof) {
        return (
          request.binding === operationBinding(request) &&
          proof.binding === request.binding &&
          proof.evidence.action === request.action &&
          proof.evidence.receipt === `authority:${request.requestId}` &&
          (!("result" in proof.evidence) ||
            JSON.stringify(proof.evidence) ===
              JSON.stringify(storedProof(request)?.evidence))
        );
      },
    },
  };
  return definition;
}
