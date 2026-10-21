import type {
  Action,
  Definition,
  Intent,
  Journal,
  Preview,
  Receipt,
  Request,
  Owner,
} from "./contract";
export type SyntheticModel = {
  [A in Action]: {
    input: { note: string };
    preview: Preview & { action: A };
    evidence: { action: A; receipt: string };
  };
};
export type Identity = { voucher: string };
export type Baseline = { revision: string; configuration: string };
export type SyntheticRequest = Request<SyntheticModel, Identity, Baseline>;
export type SyntheticJournal = Journal<SyntheticModel, Identity, Baseline>;
export type Scenario =
  | "success"
  | "unknown"
  | "not-applied"
  | "wrong-proof"
  | "refresh-failure"
  | "save-failure"
  | "seal-failure";
export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function synthetic(
  storage: Store,
  scenario: () => Scenario,
  log: (message: string) => void = () => {},
) {
  const key = (owner: Owner) =>
    `PROTOTYPE-24-wipe-me:${JSON.stringify([owner.scope, owner.operator, owner.resource])}`;
  const read = (owner: Owner): SyntheticJournal | null => {
    const raw = storage.getItem(key(owner));
    if (!raw) return null;
    const record = JSON.parse(raw) as SyntheticJournal;
    if (
      !record.request?.requestId ||
      !record.request.owner ||
      !record.request.binding ||
      !record.request.preview?.sections ||
      !record.request.input ||
      !record.request.identity ||
      !record.request.concurrency
    )
      throw new Error("合成存储损坏；请保留原记录，禁止新办理。");
    return record;
  };
  const receipt = (
    request: SyntheticRequest,
    status: "applied" | "not-applied",
    sealed = false,
  ): Receipt<SyntheticModel> =>
    ({
      action: request.action,
      owner: request.owner,
      requestId: request.requestId,
      binding: request.binding,
      evidence: {
        action: request.action,
        receipt: `authority:${request.requestId}`,
      },
      ...(status === "applied" ? { status } : { status, sealed }),
    }) as Receipt<SyntheticModel>;
  function authority(request: SyntheticRequest) {
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
  function storedProof(
    request: SyntheticRequest,
  ): Receipt<SyntheticModel> | null {
    const raw = storage.getItem(`PROTOTYPE-24-authority:${request.requestId}`);
    if (!raw) return null;
    const proof = JSON.parse(raw) as Receipt<SyntheticModel>;
    if (
      proof.binding !== request.binding ||
      request.binding !== authority(request)
    )
      throw new Error("合成原请求内容冲突");
    return proof;
  }
  const definition: Definition<SyntheticModel, Identity, Baseline> = {
    protocol: "operation",
    persistence: {
      async load(owner) {
        return read(owner);
      },
      async save(record, expectedId) {
        if (scenario() === "save-failure") throw new Error("合成存储不可写");
        const existing = read(record.request.owner);
        if ((existing?.request.requestId ?? null) !== expectedId)
          throw new Error("原请求槽已占用或发生并发变化");
        storage.setItem(key(record.request.owner), JSON.stringify(record));
        log(
          `save:${record.request.requestId}:${record.receipt?.status ?? "unresolved"}`,
        );
      },
      async remove(owner, expectedId) {
        if (read(owner)?.request.requestId !== expectedId)
          throw new Error("拒绝删除另一原请求");
        storage.removeItem(key(owner));
        log(`remove:${expectedId}`);
      },
    },
    adapter: {
      async prepare(intent: Intent<SyntheticModel, Identity>) {
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
                      { label: "单号", value: intent.identity.voucher },
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
        return { ...request, binding: authority(request) };
      },
      acceptsPreparation(intent, prepared) {
        return (
          intent.action === prepared.action &&
          intent.identity.voucher === prepared.identity.voucher &&
          intent.input.note === prepared.input.note &&
          prepared.binding === authority(prepared)
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
          `PROTOTYPE-24-authority:${request.requestId}`,
          JSON.stringify(proof),
        );
        if (scenario() === "unknown" || scenario() === "wrong-proof")
          return { status: "unknown" };
        return proof;
      },
      async reconcile(request) {
        log(`reconcile:${request.requestId}:${request.owner.operator}`);
        const proof = storedProof(request) ?? receipt(request, "not-applied");
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
          `PROTOTYPE-24-authority:${request.requestId}`,
          JSON.stringify(proof),
        );
        return proof;
      },
      async refresh({ owner, identity }) {
        log(`refresh:${owner.operator}:${identity.voucher}`);
        if (scenario() === "refresh-failure")
          throw new Error("合成刷新失败；只允许重读，不再执行");
      },
      accepts(request, proof) {
        return (
          request.binding === authority(request) &&
          proof.binding === request.binding &&
          proof.evidence.action === request.action &&
          proof.evidence.receipt === `authority:${request.requestId}`
        );
      },
    },
  };
  return definition;
}
