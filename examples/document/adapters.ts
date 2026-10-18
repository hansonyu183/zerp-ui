import {
  defineDocument,
  type Fields,
  type DocumentAdapter,
  type DocumentSnapshot,
  type DocumentAttempt,
  type StageAttempt,
  type DocumentReconciliation,
} from "@zerp/ui";
export type Scenario =
  | "success"
  | "conflict"
  | "stage-unknown"
  | "business-unknown"
  | "no-evidence"
  | "refresh-failure";
export type Pricing = {
  name: string;
  pricing: { customer: string; amount: string }[];
};
export type Formula = {
  name: string;
  formula: { material: string; quantity: string }[];
};
type Identity = {
  subject: string;
  revision: string;
  submission: string | null;
};
type Owner = { archive: string };
type Handle = { artifact: string; filename: string };
type Evidence = {
  request: string;
  revision: string;
  state: string;
  receipt: string;
};
type Attempt<D> =
  | DocumentAttempt<D, Identity, string, Handle>
  | StageAttempt<Identity, string, Owner>;
export function sample<D extends { name: string }>(
  resource: string,
  title: string,
  fields: Fields<D>,
  initial: D,
  scenario: () => Scenario,
) {
  let revision = 2,
    failRead = false;
  const snapshot = (
    values: D,
    rev: number,
    candidate = false,
  ): DocumentSnapshot<D, Identity, string, Owner, Handle> => ({
    label: `v${rev}`,
    identity: {
      subject: resource,
      revision: `r${rev}`,
      submission: candidate ? `submission-${rev}` : null,
    },
    state: candidate ? "待审批" : "已生效",
    values: structuredClone(values),
    owner: { archive: resource },
    attachments: [],
    eligible: {
      edit: true,
      approve: candidate,
      enable: false,
      disable: !candidate,
    },
  });
  let official = snapshot(initial, revision),
    candidate: typeof official | null = null;
  const history = [snapshot({ ...initial, name: "合成历史快照" }, 1)];
  const audit = [{ event: "合成初始发布" }];
  const files = new Map<string, File>();
  const receipts = new Map<string, { attempt: Attempt<D>; handle?: Handle }>();
  function record(a: Attempt<D>, handle?: Handle) {
    if (scenario() !== "no-evidence")
      receipts.set(a.id, { attempt: structuredClone(a), handle });
  }
  const adapter: DocumentAdapter<
    D,
    Identity,
    string,
    Owner,
    Handle,
    { event: string }
  > = {
    async query() {
      if (failRead) {
        failRead = false;
        throw new Error("合成刷新失败");
      }
      return structuredClone({ official, candidate, history, audit });
    },
    async submit(a) {
      if (
        scenario() === "conflict" ||
        a.identity.revision !== (candidate ?? official).identity.revision
      )
        return { status: "failure", message: "合成修订冲突" };
      candidate = snapshot(a.input, ++revision, true);
      candidate.attachments = a.attachments.map((handle) => ({
        label: handle.filename,
        handle,
      }));
      record(a);
      audit.push({ event: `提交 ${a.id}` });
      if (scenario() === "business-unknown" || scenario() === "no-evidence")
        return { status: "unknown" };
      failRead = scenario() === "refresh-failure";
      return { status: "success" };
    },
    async approve(a) {
      if (
        !candidate ||
        a.identity.submission !== candidate.identity.submission ||
        a.identity.revision !== candidate.identity.revision ||
        a.state !== candidate.state
      )
        return { status: "failure", message: "合成候选修订不符" };
      history.push(structuredClone(official));
      official = {
        ...candidate,
        state: "已生效",
        identity: { ...candidate.identity, submission: null },
        eligible: { edit: true, disable: true },
      };
      candidate = null;
      record(a);
      audit.push({ event: `审批 ${a.id}` });
      return { status: "success" };
    },
    async disable(a) {
      if (
        a.identity.revision !== official.identity.revision ||
        a.state !== official.state
      )
        return { status: "failure", message: "合成修订冲突" };
      official = {
        ...official,
        state: "停用",
        eligible: { edit: true, enable: true },
      };
      record(a);
      return { status: "success" };
    },
    async enable(a) {
      if (
        a.identity.revision !== official.identity.revision ||
        a.state !== official.state
      )
        return { status: "failure", message: "合成修订冲突" };
      official = {
        ...official,
        state: "已生效",
        eligible: { edit: true, disable: true },
      };
      record(a);
      return { status: "success" };
    },
    attachments: {
      validate: (file) =>
        file.size > 1024 * 1024
          ? "合成示例最多 1 MiB"
          : file.type !== "text/plain"
            ? "合成示例仅接收文本文件"
            : undefined,
      async stage(a) {
        if (a.owner.archive !== resource)
          return { status: "failure", message: "附件所属档案不符" };
        const handle = { artifact: a.fileId, filename: a.file.name };
        files.set(handle.artifact, a.file);
        record(a, handle);
        if (scenario() === "stage-unknown" || scenario() === "no-evidence")
          return { status: "unknown" };
        return { status: "success", handle };
      },
      async read({ owner, handle }) {
        const file = files.get(handle.artifact);
        if (owner.archive !== resource || !file)
          throw new Error("合成附件不存在");
        return { content: file, filename: handle.filename };
      },
    },
  };
  return defineDocument<
    D,
    Identity,
    string,
    Owner,
    Handle,
    { event: string },
    Evidence
  >({
    resource,
    title,
    fields,
    auditColumns: [{ key: "event", label: "事件" }],
    adapter,
    async reconcile(a): Promise<DocumentReconciliation<Handle, Evidence>> {
      const receipt = receipts.get(a.id);
      // Exact original identity, revision, submission, state and request receipt;
      // no comparison with a current-value read or unrelated historical action.
      if (
        !receipt ||
        receipt.attempt.operation !== a.operation ||
        JSON.stringify(receipt.attempt.identity) !==
          JSON.stringify(a.identity) ||
        receipt.attempt.state !== a.state
      )
        return { status: "unknown" };
      const evidence = {
        request: a.id,
        revision: a.identity.revision,
        state: a.state,
        receipt: `synthetic-${a.id}`,
      };
      return a.operation === "stage" && receipt.handle
        ? {
            status: "applied",
            operation: "stage",
            attemptId: a.id,
            evidence,
            handle: receipt.handle,
          }
        : a.operation !== "stage"
          ? {
              status: "applied",
              operation: "business",
              attemptId: a.id,
              evidence,
            }
          : { status: "unknown" };
    },
  });
}
