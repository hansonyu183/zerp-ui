// Shared finite operation protocol (#24, #47). Business facts and durable storage belong to consumers.
export const operationLabels = {
  create: "创建",
  edit: "保存修改",
  delete: "删除",
  send: "送审",
  withdraw: "撤回",
  approve: "审核",
  unapprove: "反审核",
  complete: "完成",
  uncomplete: "反完成",
  void: "作废",
  unvoid: "反作废",
  process: "执行处理",
  publish: "发布",
  restore: "启用历史版本",
  validate: "验证",
  run: "试运行",
  stop: "停止运行",
  import: "导入",
  preview: "生成预览",
  print: "打印",
  printed: "确认已打印",
  "not-printed": "确认未打印",
} as const;
/** Prepares the current typed intent. Execution still requires full-preview confirmation. */
export type OperationHandle = { prepare(): Promise<void> };
export type OperationAction = keyof typeof operationLabels;
export type OperationOwner = Readonly<{
  scope: string;
  operator: string;
  resource: string;
}>;
export type OperationPreview = Readonly<{
  title: string;
  sections: readonly {
    key: string;
    title: string;
    rows: readonly {
      key: string;
      fields: readonly {
        label: string;
        value: string | number | boolean | null;
      }[];
    }[];
  }[];
}>;
export type OperationModel = {
  [A in OperationAction]?: {
    input: object;
    preview: OperationPreview;
    evidence: object;
  };
};
export type OperationActionOf<M> = Extract<keyof M, OperationAction>;
export type OperationIntent<
  M extends OperationModel,
  I,
  A extends OperationActionOf<M> = OperationActionOf<M>,
> = {
  [K in A]: Readonly<{
    action: K;
    owner: OperationOwner;
    identity: I;
    input: NonNullable<M[K]>["input"];
  }>;
}[A];
export type OperationRequest<
  M extends OperationModel,
  I,
  B,
  A extends OperationActionOf<M> = OperationActionOf<M>,
> = {
  [K in A]: OperationIntent<M, I, K> &
    Readonly<{
      requestId: string;
      concurrency: B;
      preview: NonNullable<M[K]>["preview"];
      /** Consumer's authoritative binding of owner, identity, action, input, concurrency and preview. */
      binding: string;
    }>;
}[A];
export type OperationReceipt<
  M extends OperationModel,
  A extends OperationActionOf<M> = OperationActionOf<M>,
> = {
  [K in A]: Readonly<{
    action: K;
    owner: OperationOwner;
    requestId: string;
    binding: string;
    evidence: NonNullable<M[K]>["evidence"];
  }> &
    ({ status: "applied" } | { status: "not-applied"; sealed: boolean });
}[A];
export type OperationOutcome<M extends OperationModel> =
  OperationReceipt<M> | { status: "unknown" };
/** The authoritative outcome stays paired with its original action and input. */
export type OperationSettlement<M extends OperationModel, I, B> = {
  [A in OperationActionOf<M>]: Readonly<{
    request: OperationRequest<M, I, B, A>;
    receipt: OperationReceipt<M, A>;
  }>;
}[OperationActionOf<M>];
export type OperationJournal<
  M extends OperationModel,
  I,
  B,
  A extends OperationActionOf<M> = OperationActionOf<M>,
> = {
  [K in A]: Readonly<{
    request: OperationRequest<M, I, B, K>;
    receipt?: OperationReceipt<M, K>;
    refreshed?: true;
    completed?: true;
  }>;
}[A];
export type OperationPersistence<M extends OperationModel, I, B> = {
  /** With an ID, read that original journal, including retained completion evidence. */
  load(
    owner: OperationOwner,
    requestId?: string,
  ): Promise<OperationJournal<M, I, B> | null>;
  /** Atomic durable CAS. null reserves an empty/completed slot; updates preserve binding and terminal progress. */
  save(
    journal: OperationJournal<M, I, B>,
    expectedId: string | null,
  ): Promise<void>;
  /** Idempotently complete this exact journal, retaining its terminal receipt for other recovering contexts. */
  remove(owner: OperationOwner, expectedId: string): Promise<void>;
};
declare const operationModel: unique symbol;
export type OperationDefinition<M extends OperationModel, I, B> = {
  readonly [operationModel]?: (model: M) => M;
  protocol: "operation";
  confirmationLabel?: string;
  reconcileLabel?: string;
  sealLabel?: string;
  adapter: {
    prepare(intent: OperationIntent<M, I>): Promise<OperationRequest<M, I, B>>;
    /** Checks original intent identity/input plus authoritative preparation facts before confirmation. */
    acceptsPreparation(
      intent: OperationIntent<M, I>,
      prepared: OperationRequest<M, I, B>,
    ): boolean;
    execute(request: OperationRequest<M, I, B>): Promise<OperationOutcome<M>>;
    reconcile(request: OperationRequest<M, I, B>): Promise<OperationOutcome<M>>;
    /** Must fence every late/concurrent delivery of this original request. Idempotent. */
    seal(
      request: OperationRequest<M, I, B>,
      receipt: OperationReceipt<M>,
    ): Promise<OperationOutcome<M>>;
    /** Read/display the authoritative result, including created identity or deletion. Never execute again. */
    refresh(settlement: OperationSettlement<M, I, B>): Promise<void>;
    /** Consumer validates authoritative protocol evidence, full original payload and binding. */
    accepts(
      request: OperationRequest<M, I, B>,
      receipt: OperationReceipt<M>,
    ): boolean;
  };
  persistence: OperationPersistence<M, I, B>;
};
export function sameOperationOwner(a: OperationOwner, b: OperationOwner) {
  return (
    a.scope === b.scope &&
    a.operator === b.operator &&
    a.resource === b.resource
  );
}

export function defineOperation<M extends OperationModel, I, B>(
  definition: OperationDefinition<M, I, B>,
): OperationDefinition<M, I, B> {
  return definition;
}
