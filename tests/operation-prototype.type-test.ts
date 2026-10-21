import type {
  Definition,
  Intent,
  Preview,
  Receipt,
  Request,
  Journal,
} from "../examples/voucher-operation-prototype/contract";
import type {
  SyntheticModel,
  Identity,
  Baseline,
} from "../examples/voucher-operation-prototype/synthetic";
type Model = Omit<SyntheticModel, "void"> & {
  void: {
    input: { reason: string };
    preview: Preview & { action: "void" };
    evidence: { reversalReceipt: string };
  };
};
const intent: Intent<Model, Identity, "void"> = {
  action: "void",
  owner: { operator: "a", scope: "s", resource: "v" },
  identity: { voucher: "v1" },
  input: { reason: "原原因" },
};
const request: Request<Model, Identity, Baseline, "void"> = {
  ...intent,
  requestId: "original",
  binding: "consumer-authoritative-binding",
  concurrency: { revision: "r1", configuration: "c1" },
  preview: { action: "void", title: "完整预览", sections: [] },
};
const receipt: Receipt<Model, "void"> = {
  status: "not-applied",
  sealed: false,
  action: "void",
  owner: intent.owner,
  requestId: request.requestId,
  binding: request.binding,
  evidence: { reversalReceipt: "fenced-proof" },
};
const wrongAction: Intent<Model, Identity> = {
  ...intent,
  // @ts-expect-error Arbitrary string commands are not part of the finite action set.
  action: "run-script",
};
const wrongInput: Intent<Model, Identity, "void"> = {
  ...intent,
  // @ts-expect-error Input of a send action cannot be used for void.
  input: { note: "foreign" },
};
const wrongIdentity: Request<Model, Identity, Baseline, "void"> = {
  ...request,
  // @ts-expect-error Company DTO identity must be paired with this definition.
  identity: { customer: "x" },
};
const wrongConcurrency: Request<Model, Identity, Baseline, "void"> = {
  ...request,
  // @ts-expect-error A foreign concurrency fact cannot replace the accepted baseline/configuration.
  concurrency: { etag: "foreign" },
};
const wrongPreview: Request<Model, Identity, Baseline, "void"> = {
  ...request,
  // @ts-expect-error Preview is paired to the original action.
  preview: { action: "send", title: "foreign", sections: [] },
};
const wrongEvidence: Receipt<Model, "void"> = {
  ...receipt,
  // @ts-expect-error A submission ID or foreign action proof is not a void receipt.
  evidence: { submission: "fake" },
};
const record: Journal<Model, Identity, Baseline> = { request, receipt };
const wrongProtocol: Definition<Model, Identity, Baseline> = {
  // @ts-expect-error Submission and operation protocols cannot be interchanged.
  protocol: "submission",
  adapter: {} as Definition<Model, Identity, Baseline>["adapter"],
  persistence: {} as Definition<Model, Identity, Baseline>["persistence"],
};
void [
  wrongAction,
  wrongInput,
  wrongIdentity,
  wrongConcurrency,
  wrongPreview,
  wrongEvidence,
  record,
  wrongProtocol,
];
const foreignReceipt: Receipt<Model, "send"> = {
  status: "applied",
  owner: intent.owner,
  requestId: "foreign",
  binding: "foreign",
  action: "send",
  evidence: { action: "send", receipt: "foreign" },
};
const paired: Journal<Model, Identity, Baseline, "void"> = {
  request,
  // @ts-expect-error A send receipt cannot settle a void request, even in durable recovery.
  receipt: foreignReceipt,
};
void paired;
