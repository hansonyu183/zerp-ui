import type {
  BatchJournal,
  OperationJournal,
  OperationOwner,
} from "../assembly";
import {
  authoritativeOriginals,
  authoritativeReceipts,
  legacyBatch,
  legacySingle,
  batchId,
  proof,
  type MigrationModel,
  type Request,
  type Receipt,
} from "./migration-fixtures";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
type Converted = {
  batch?: BatchJournal<MigrationModel, string, number>;
  journals: OperationJournal<MigrationModel, string, number>[];
};
export type Conversion =
  | { status: "accepted"; source: string; value: Converted }
  | { status: "refused"; source: string; reason: string };
/** Only this finite synthetic v1 artifact; never a public API or production converter. */
export function convertLegacy(
  source: string,
  owner: OperationOwner,
): Conversion {
  try {
    const raw = JSON.parse(source);
    const require = (condition: unknown) => {
      if (!condition)
        throw Error("原始输入、身份、关联或权威证据不足，保留原件并拒绝转换。");
    };
    require(same(raw.owner, owner));
    const verifyOriginal = (request: Request) =>
      require(
        authoritativeOriginals.some((known) => same(known, request)) &&
          same(request?.owner, owner),
      );
    if (raw.format === "synthetic-single-v1") {
      require(
        raw.status === "unknown" &&
          !raw.receipt &&
          !raw.association &&
          same(raw.original, legacySingle.original),
      );
      verifyOriginal(raw.original);
      return {
        status: "accepted",
        source,
        value: { journals: [{ request: structuredClone(raw.original) }] },
      };
    }
    require(
      raw.format === "synthetic-batch-v1" &&
        typeof raw.id === "string" &&
        raw.id === batchId &&
        Array.isArray(raw.entries) &&
        raw.entries.length === legacyBatch.entries.length,
    );
    require(
      Number.isInteger(raw.index) &&
        raw.index >= 0 &&
        raw.index < raw.entries.length &&
        new Set(raw.entries.map((e: { key: unknown }) => e.key)).size ===
          raw.entries.length,
    );
    const journals: Converted["journals"] = [];
    let pending = 0;
    const entries = raw.entries.map(
      (
        entry: {
          key: string;
          label: string;
          intent: Request;
          status: string;
          original?: Request;
          receipt?: Receipt;
          refreshed?: boolean;
          completed?: boolean;
          association?: unknown;
        },
        index: number,
      ) => {
        require(
          typeof entry.key === "string" &&
            entry.key.length > 0 &&
            typeof entry.label === "string" &&
            same(entry.intent.owner, owner),
        );
        require(
          entry.key === legacyBatch.entries[index]?.key &&
            entry.label === legacyBatch.entries[index]?.label &&
            same(entry.intent, legacyBatch.entries[index]?.intent),
        );
        const base = {
          key: entry.key,
          label: entry.label,
          intent: structuredClone(entry.intent),
        };
        if (entry.status === "never-sent") {
          require(
            !authoritativeOriginals.some((known) =>
              same(known.identity, entry.intent.identity),
            ) &&
              !entry.original &&
              !entry.receipt &&
              !entry.association &&
              index >= raw.index,
          );
          return base;
        }
        require(
          entry.status === "unknown" ||
            entry.status === "applied" ||
            entry.status === "sealed",
        );
        verifyOriginal(entry.original!);
        const request = entry.original!;
        require(
          same(
            {
              owner: request.owner,
              identity: request.identity,
              action: request.action,
              input: request.input,
            },
            entry.intent,
          ),
        );
        const association = {
          kind: "batch" as const,
          batchId: raw.id,
          entryKey: entry.key,
        };
        require(same(entry.association, association));
        if (entry.status === "unknown") {
          require(!entry.receipt && index === raw.index && ++pending === 1);
          journals.push({ request: structuredClone(request), association });
          return base;
        }
        require(
          same(entry.receipt, authoritativeReceipts[request.requestId]) &&
            same(entry.receipt, proof(request, entry.status === "applied")) &&
            entry.refreshed === true &&
            entry.completed === true,
        );
        const settlement = {
          request: structuredClone(request),
          receipt: structuredClone(entry.receipt!),
          association,
        };
        journals.push({ ...settlement, refreshed: true, completed: true });
        return { ...base, settlement };
      },
    );
    require(
      entries
        .slice(0, raw.index)
        .every((e: { settlement?: unknown }) => !!e.settlement),
    );
    return {
      status: "accepted",
      source,
      value: {
        batch: {
          id: raw.id,
          owner: structuredClone(owner),
          entries,
          index: raw.index,
        },
        journals,
      },
    };
  } catch {
    return {
      status: "refused",
      source,
      reason: "原始输入、身份、关联或权威证据不足，保留原件并拒绝转换。",
    };
  }
}
