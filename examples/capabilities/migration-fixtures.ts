import type {
  OperationPreview,
  OperationOwner,
  OperationRequest,
  OperationReceipt,
  OperationAssociation,
} from "@zerp/ui";
export type MigrationModel = {
  process: {
    input: { value: string };
    preview: OperationPreview;
    evidence: { requestId: string; binding: string };
  };
};
export const migrationOwner: OperationOwner = {
  scope: "synthetic-session",
  operator: "synthetic-operator",
  resource: "legacy-batch",
};
export type Request = OperationRequest<MigrationModel, string, number>;
export type Receipt = OperationReceipt<MigrationModel>;
export function original(key: string, owner = migrationOwner): Request {
  return {
    owner,
    identity: key,
    action: "process",
    input: { value: key },
    requestId: `legacy-request-${key}`,
    binding: `authority-binding-${key}`,
    concurrency: 7,
    preview: { title: `原始预览 ${key}`, sections: [] },
  };
}
export function proof(request: Request, applied = true): Receipt {
  return {
    ...(applied
      ? { status: "applied" as const }
      : { status: "not-applied" as const, sealed: true }),
    owner: request.owner,
    action: request.action,
    requestId: request.requestId,
    binding: request.binding,
    evidence: { requestId: request.requestId, binding: request.binding },
  };
}
export const batchId = "legacy-batch-2026";
export function association(key: string): OperationAssociation {
  return { kind: "batch", batchId, entryKey: key };
}
export const legacyBatch = {
  format: "synthetic-batch-v1",
  id: batchId,
  owner: migrationOwner,
  index: 2,
  entries: ["applied", "sealed", "unknown", "never-sent"].map((key) => ({
    key,
    label: key,
    intent: {
      owner: migrationOwner,
      identity: key,
      action: "process",
      input: { value: key },
    },
    status: key,
    ...(key === "never-sent"
      ? {}
      : { original: original(key), association: association(key) }),
    ...(key === "applied" || key === "sealed"
      ? {
          receipt: proof(original(key), key === "applied"),
          refreshed: true,
          completed: true,
        }
      : {}),
  })),
};
export const legacySingle = {
  format: "synthetic-single-v1",
  owner: migrationOwner,
  status: "unknown",
  original: original("single"),
};
/** Synthetic external authority ledger: status strings in the source are never proof. */
export const authoritativeOriginals = [
  "applied",
  "sealed",
  "unknown",
  "single",
].map((key) => original(key));
export const authoritativeReceipts: Readonly<Record<string, Receipt>> =
  Object.fromEntries(
    authoritativeOriginals.map((request) => [
      request.requestId,
      proof(request, request.identity !== "sealed"),
    ]),
  );
