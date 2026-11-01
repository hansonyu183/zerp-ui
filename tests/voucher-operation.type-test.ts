import type {
  OperationDefinition,
  OperationIntent,
  OperationPreview,
  OperationReceipt,
  OperationRequest,
  OperationJournal,
  OperationSettlement,
} from "../src/index";
import type {
  SyntheticModel,
  Identity,
  Baseline,
} from "../examples/voucher/operation-adapter";
type OperationModel = Omit<SyntheticModel, "void"> & {
  void: {
    input: { reason: string };
    preview: OperationPreview & { action: "void" };
    evidence: { reversalReceipt: string };
  };
};
const intent: OperationIntent<OperationModel, Identity, "void"> = {
  action: "void",
  owner: { operator: "a", scope: "s", resource: "v" },
  identity: { voucher: "v1" },
  input: { reason: "原原因" },
};
const request: OperationRequest<OperationModel, Identity, Baseline, "void"> = {
  ...intent,
  requestId: "original",
  binding: "consumer-authoritative-binding",
  concurrency: { revision: "r1", configuration: "c1" },
  preview: { action: "void", title: "完整预览", sections: [] },
};
const receipt: OperationReceipt<OperationModel, "void"> = {
  status: "not-applied",
  sealed: false,
  action: "void",
  owner: intent.owner,
  requestId: request.requestId,
  binding: request.binding,
  evidence: { reversalReceipt: "fenced-proof" },
};
const wrongAction: OperationIntent<OperationModel, Identity> = {
  ...intent,
  // @ts-expect-error Arbitrary string commands are not part of the finite action set.
  action: "run-script",
};
const wrongInput: OperationIntent<OperationModel, Identity, "void"> = {
  ...intent,
  // @ts-expect-error Input of a send action cannot be used for void.
  input: { note: "foreign" },
};
const wrongIdentity: OperationRequest<
  OperationModel,
  Identity,
  Baseline,
  "void"
> = {
  ...request,
  // @ts-expect-error Company DTO identity must be paired with this definition.
  identity: { customer: "x" },
};
const wrongConcurrency: OperationRequest<
  OperationModel,
  Identity,
  Baseline,
  "void"
> = {
  ...request,
  // @ts-expect-error A foreign concurrency fact cannot replace the accepted baseline/configuration.
  concurrency: { etag: "foreign" },
};
const wrongPreview: OperationRequest<
  OperationModel,
  Identity,
  Baseline,
  "void"
> = {
  ...request,
  // @ts-expect-error OperationPreview is paired to the original action.
  preview: { action: "send", title: "foreign", sections: [] },
};
const wrongEvidence: OperationReceipt<OperationModel, "void"> = {
  ...receipt,
  // @ts-expect-error A submission ID or foreign action proof is not a void receipt.
  evidence: { submission: "fake" },
};
const record: OperationJournal<OperationModel, Identity, Baseline> = {
  request,
  receipt,
};
const wrongProtocol: OperationDefinition<OperationModel, Identity, Baseline> = {
  // @ts-expect-error Submission and operation protocols cannot be interchanged.
  protocol: "submission",
  adapter: {} as OperationDefinition<
    OperationModel,
    Identity,
    Baseline
  >["adapter"],
  persistence: {} as OperationDefinition<
    OperationModel,
    Identity,
    Baseline
  >["persistence"],
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
const foreignReceipt: OperationReceipt<OperationModel, "send"> = {
  status: "applied",
  owner: intent.owner,
  requestId: "foreign",
  binding: "foreign",
  action: "send",
  evidence: { action: "send", receipt: "foreign" },
};
const paired: OperationJournal<OperationModel, Identity, Baseline, "void"> = {
  request,
  // @ts-expect-error A send receipt cannot settle a void request, even in durable recovery.
  receipt: foreignReceipt,
};
void paired;

const create: OperationIntent<SyntheticModel, Identity, "create"> = {
  action: "create",
  owner: intent.owner,
  identity: { voucher: null },
  input: { note: "新内容", rows: [{ key: "r1", quantity: "1.0100" }] },
};
const createdRequest: OperationRequest<
  SyntheticModel,
  Identity,
  Baseline,
  "create"
> = {
  ...create,
  requestId: "create-original",
  binding: "create-binding",
  concurrency: request.concurrency,
  preview: { action: "create", title: "创建预览", sections: [] },
};
const createdReceipt: OperationReceipt<SyntheticModel, "create"> = {
  action: "create",
  status: "applied",
  owner: intent.owner,
  requestId: "create-original",
  binding: "create-binding",
  evidence: {
    action: "create",
    receipt: "created-proof",
    result: { voucher: "new-server-identity", deleted: false },
  },
};
const settled: OperationSettlement<SyntheticModel, Identity, Baseline> = {
  request: createdRequest,
  receipt: createdReceipt,
};
// @ts-expect-error A state receipt cannot settle a content create request.
const mismatchedSettlement: OperationSettlement<
  SyntheticModel,
  Identity,
  Baseline
> = { request: createdRequest, receipt: foreignReceipt };
const invalidCreate: OperationIntent<SyntheticModel, Identity, "create"> = {
  ...create,
  // @ts-expect-error Content requests require their complete typed input, not a reason-only state input.
  input: { note: "missing rows" },
};
void [settled, mismatchedSettlement, invalidCreate];

declare const handle: import("../src/index").AppPageHandle;
// @ts-expect-error Preparing is owned by the complete page, not a public VM.
handle.prepare();
const leaving: Promise<boolean> = handle.requestLeave();
void leaving;
