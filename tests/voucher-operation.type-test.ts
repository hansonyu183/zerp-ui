import type {
  VoucherOperationDefinition,
  VoucherOperationIntent,
  VoucherOperationPreview,
  VoucherOperationReceipt,
  VoucherOperationRequest,
  VoucherOperationJournal,
  VoucherOperationSettlement,
} from "../src/index";
import type {
  SyntheticModel,
  Identity,
  Baseline,
} from "../examples/voucher/operation-adapter";
type VoucherOperationModel = Omit<SyntheticModel, "void"> & {
  void: {
    input: { reason: string };
    preview: VoucherOperationPreview & { action: "void" };
    evidence: { reversalReceipt: string };
  };
};
const intent: VoucherOperationIntent<VoucherOperationModel, Identity, "void"> =
  {
    action: "void",
    owner: { operator: "a", scope: "s", resource: "v" },
    identity: { voucher: "v1" },
    input: { reason: "原原因" },
  };
const request: VoucherOperationRequest<
  VoucherOperationModel,
  Identity,
  Baseline,
  "void"
> = {
  ...intent,
  requestId: "original",
  binding: "consumer-authoritative-binding",
  concurrency: { revision: "r1", configuration: "c1" },
  preview: { action: "void", title: "完整预览", sections: [] },
};
const receipt: VoucherOperationReceipt<VoucherOperationModel, "void"> = {
  status: "not-applied",
  sealed: false,
  action: "void",
  owner: intent.owner,
  requestId: request.requestId,
  binding: request.binding,
  evidence: { reversalReceipt: "fenced-proof" },
};
const wrongAction: VoucherOperationIntent<VoucherOperationModel, Identity> = {
  ...intent,
  // @ts-expect-error Arbitrary string commands are not part of the finite action set.
  action: "run-script",
};
const wrongInput: VoucherOperationIntent<
  VoucherOperationModel,
  Identity,
  "void"
> = {
  ...intent,
  // @ts-expect-error Input of a send action cannot be used for void.
  input: { note: "foreign" },
};
const wrongIdentity: VoucherOperationRequest<
  VoucherOperationModel,
  Identity,
  Baseline,
  "void"
> = {
  ...request,
  // @ts-expect-error Company DTO identity must be paired with this definition.
  identity: { customer: "x" },
};
const wrongConcurrency: VoucherOperationRequest<
  VoucherOperationModel,
  Identity,
  Baseline,
  "void"
> = {
  ...request,
  // @ts-expect-error A foreign concurrency fact cannot replace the accepted baseline/configuration.
  concurrency: { etag: "foreign" },
};
const wrongPreview: VoucherOperationRequest<
  VoucherOperationModel,
  Identity,
  Baseline,
  "void"
> = {
  ...request,
  // @ts-expect-error VoucherOperationPreview is paired to the original action.
  preview: { action: "send", title: "foreign", sections: [] },
};
const wrongEvidence: VoucherOperationReceipt<VoucherOperationModel, "void"> = {
  ...receipt,
  // @ts-expect-error A submission ID or foreign action proof is not a void receipt.
  evidence: { submission: "fake" },
};
const record: VoucherOperationJournal<
  VoucherOperationModel,
  Identity,
  Baseline
> = { request, receipt };
const wrongProtocol: VoucherOperationDefinition<
  VoucherOperationModel,
  Identity,
  Baseline
> = {
  // @ts-expect-error Submission and operation protocols cannot be interchanged.
  protocol: "submission",
  adapter: {} as VoucherOperationDefinition<
    VoucherOperationModel,
    Identity,
    Baseline
  >["adapter"],
  persistence: {} as VoucherOperationDefinition<
    VoucherOperationModel,
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
const foreignReceipt: VoucherOperationReceipt<VoucherOperationModel, "send"> = {
  status: "applied",
  owner: intent.owner,
  requestId: "foreign",
  binding: "foreign",
  action: "send",
  evidence: { action: "send", receipt: "foreign" },
};
const paired: VoucherOperationJournal<
  VoucherOperationModel,
  Identity,
  Baseline,
  "void"
> = {
  request,
  // @ts-expect-error A send receipt cannot settle a void request, even in durable recovery.
  receipt: foreignReceipt,
};
void paired;

const create: VoucherOperationIntent<SyntheticModel, Identity, "create"> = {
  action: "create",
  owner: intent.owner,
  identity: { voucher: null },
  input: { note: "新内容", rows: [{ key: "r1", quantity: "1.0100" }] },
};
const createdRequest: VoucherOperationRequest<
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
const createdReceipt: VoucherOperationReceipt<SyntheticModel, "create"> = {
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
const settled: VoucherOperationSettlement<SyntheticModel, Identity, Baseline> =
  {
    request: createdRequest,
    receipt: createdReceipt,
  };
// @ts-expect-error A state receipt cannot settle a content create request.
const mismatchedSettlement: VoucherOperationSettlement<
  SyntheticModel,
  Identity,
  Baseline
> = { request: createdRequest, receipt: foreignReceipt };
const invalidCreate: VoucherOperationIntent<
  SyntheticModel,
  Identity,
  "create"
> = {
  ...create,
  // @ts-expect-error Content requests require their complete typed input, not a reason-only state input.
  input: { note: "missing rows" },
};
void [settled, mismatchedSettlement, invalidCreate];
