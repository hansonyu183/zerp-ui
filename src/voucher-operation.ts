// Finite operation protocol decided in #24; domain facts and durable storage belong to consumers.
export const voucherOperationLabels = {
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
} as const;
/** Prepares the current typed intent. Execution still requires full-preview confirmation. */
export type VoucherOperationHandle = { prepare(): Promise<void> };
export type VoucherOperationAction = keyof typeof voucherOperationLabels;
export type VoucherOperationOwner = Readonly<{
  scope: string;
  operator: string;
  resource: string;
}>;
export type VoucherOperationPreview = Readonly<{
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
export type VoucherOperationModel = {
  [A in VoucherOperationAction]: {
    input: object;
    preview: VoucherOperationPreview;
    evidence: object;
  };
};
export type VoucherOperationIntent<
  M extends VoucherOperationModel,
  I,
  A extends VoucherOperationAction = VoucherOperationAction,
> = {
  [K in A]: Readonly<{
    action: K;
    owner: VoucherOperationOwner;
    identity: I;
    input: M[K]["input"];
  }>;
}[A];
export type VoucherOperationRequest<
  M extends VoucherOperationModel,
  I,
  B,
  A extends VoucherOperationAction = VoucherOperationAction,
> = {
  [K in A]: VoucherOperationIntent<M, I, K> &
    Readonly<{
      requestId: string;
      concurrency: B;
      preview: M[K]["preview"];
      /** Consumer's authoritative binding of owner, identity, action, input, concurrency and preview. */
      binding: string;
    }>;
}[A];
export type VoucherOperationReceipt<
  M extends VoucherOperationModel,
  A extends VoucherOperationAction = VoucherOperationAction,
> = {
  [K in A]: Readonly<{
    action: K;
    owner: VoucherOperationOwner;
    requestId: string;
    binding: string;
    evidence: M[K]["evidence"];
  }> &
    ({ status: "applied" } | { status: "not-applied"; sealed: boolean });
}[A];
export type VoucherOperationOutcome<M extends VoucherOperationModel> =
  VoucherOperationReceipt<M> | { status: "unknown" };
/** The authoritative outcome stays paired with its original action and input. */
export type VoucherOperationSettlement<
  M extends VoucherOperationModel,
  I,
  B,
> = {
  [A in VoucherOperationAction]: Readonly<{
    request: VoucherOperationRequest<M, I, B, A>;
    receipt: VoucherOperationReceipt<M, A>;
  }>;
}[VoucherOperationAction];
export type VoucherOperationJournal<
  M extends VoucherOperationModel,
  I,
  B,
  A extends VoucherOperationAction = VoucherOperationAction,
> = {
  [K in A]: Readonly<{
    request: VoucherOperationRequest<M, I, B, K>;
    receipt?: VoucherOperationReceipt<M, K>;
    refreshed?: true;
    completed?: true;
  }>;
}[A];
export type VoucherOperationPersistence<
  M extends VoucherOperationModel,
  I,
  B,
> = {
  /** With an ID, read that original journal, including retained completion evidence. */
  load(
    owner: VoucherOperationOwner,
    requestId?: string,
  ): Promise<VoucherOperationJournal<M, I, B> | null>;
  /** Atomic durable CAS. null reserves an empty/completed slot; updates preserve binding and terminal progress. */
  save(
    journal: VoucherOperationJournal<M, I, B>,
    expectedId: string | null,
  ): Promise<void>;
  /** Idempotently complete this exact journal, retaining its terminal receipt for other recovering contexts. */
  remove(owner: VoucherOperationOwner, expectedId: string): Promise<void>;
};
declare const operationModel: unique symbol;
export type VoucherOperationDefinition<
  M extends VoucherOperationModel,
  I,
  B,
> = {
  readonly [operationModel]?: (model: M) => M;
  protocol: "operation";
  confirmationLabel?: string;
  reconcileLabel?: string;
  sealLabel?: string;
  adapter: {
    prepare(
      intent: VoucherOperationIntent<M, I>,
    ): Promise<VoucherOperationRequest<M, I, B>>;
    /** Checks original intent identity/input plus authoritative preparation facts before confirmation. */
    acceptsPreparation(
      intent: VoucherOperationIntent<M, I>,
      prepared: VoucherOperationRequest<M, I, B>,
    ): boolean;
    execute(
      request: VoucherOperationRequest<M, I, B>,
    ): Promise<VoucherOperationOutcome<M>>;
    reconcile(
      request: VoucherOperationRequest<M, I, B>,
    ): Promise<VoucherOperationOutcome<M>>;
    /** Must fence every late/concurrent delivery of this original request. Idempotent. */
    seal(
      request: VoucherOperationRequest<M, I, B>,
      receipt: VoucherOperationReceipt<M>,
    ): Promise<VoucherOperationOutcome<M>>;
    /** Read/display the authoritative result, including created identity or deletion. Never execute again. */
    refresh(settlement: VoucherOperationSettlement<M, I, B>): Promise<void>;
    /** Consumer validates authoritative protocol evidence, full original payload and binding. */
    accepts(
      request: VoucherOperationRequest<M, I, B>,
      receipt: VoucherOperationReceipt<M>,
    ): boolean;
  };
  persistence: VoucherOperationPersistence<M, I, B>;
};
export function sameOperationOwner(
  a: VoucherOperationOwner,
  b: VoucherOperationOwner,
) {
  return (
    a.scope === b.scope &&
    a.operator === b.operator &&
    a.resource === b.resource
  );
}

export function defineVoucherOperation<M extends VoucherOperationModel, I, B>(
  definition: VoucherOperationDefinition<M, I, B>,
): VoucherOperationDefinition<M, I, B> {
  return definition;
}
