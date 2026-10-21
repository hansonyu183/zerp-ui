// Proposed contract for #24 only. Not exported or shipped by @zerp/ui.
export const actionLabels = {
  send: "送审",
  withdraw: "撤回",
  approve: "审核",
  unapprove: "反审核",
  complete: "完成",
  uncomplete: "反完成",
  void: "作废",
  unvoid: "反作废",
} as const;
export type Action = keyof typeof actionLabels;
export type Owner = Readonly<{
  scope: string;
  operator: string;
  resource: string;
}>;
export type Preview = Readonly<{
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
export type Model = {
  [A in Action]: { input: object; preview: Preview; evidence: object };
};
export type Intent<M extends Model, I, A extends Action = Action> = {
  [K in A]: Readonly<{
    action: K;
    owner: Owner;
    identity: I;
    input: M[K]["input"];
  }>;
}[A];
export type Request<M extends Model, I, B, A extends Action = Action> = {
  [K in A]: Intent<M, I, K> &
    Readonly<{
      requestId: string;
      concurrency: B;
      preview: M[K]["preview"];
      /** Consumer's authoritative binding of owner, identity, action, input, concurrency and preview. */
      binding: string;
    }>;
}[A];
export type Receipt<M extends Model, A extends Action = Action> = {
  [K in A]: Readonly<{
    action: K;
    owner: Owner;
    requestId: string;
    binding: string;
    evidence: M[K]["evidence"];
  }> &
    ({ status: "applied" } | { status: "not-applied"; sealed: boolean });
}[A];
export type Outcome<M extends Model> = Receipt<M> | { status: "unknown" };
export type Journal<M extends Model, I, B, A extends Action = Action> = {
  [K in A]: Readonly<{ request: Request<M, I, B, K>; receipt?: Receipt<M, K> }>;
}[A];
export type Persistence<M extends Model, I, B> = {
  load(owner: Owner): Promise<Journal<M, I, B> | null>;
  /** Durable, atomic compare-and-set. null reserves an empty slot; ID updates only that request. */
  save(journal: Journal<M, I, B>, expectedId: string | null): Promise<void>;
  remove(owner: Owner, expectedId: string): Promise<void>;
};
export type Definition<M extends Model, I, B> = {
  protocol: "operation";
  adapter: {
    prepare(intent: Intent<M, I>): Promise<Request<M, I, B>>;
    /** Checks original intent identity/input plus authoritative preparation facts before confirmation. */
    acceptsPreparation(
      intent: Intent<M, I>,
      prepared: Request<M, I, B>,
    ): boolean;
    execute(request: Request<M, I, B>): Promise<Outcome<M>>;
    reconcile(request: Request<M, I, B>): Promise<Outcome<M>>;
    /** Must fence every late/concurrent delivery of this original request. Idempotent. */
    seal(request: Request<M, I, B>, receipt: Receipt<M>): Promise<Outcome<M>>;
    refresh(context: { owner: Owner; identity: I }): Promise<void>;
    /** Consumer validates authoritative protocol evidence, full original payload and binding. */
    accepts(request: Request<M, I, B>, receipt: Receipt<M>): boolean;
  };
  persistence: Persistence<M, I, B>;
};
export function sameOwner(a: Owner, b: Owner) {
  return (
    a.scope === b.scope &&
    a.operator === b.operator &&
    a.resource === b.resource
  );
}
