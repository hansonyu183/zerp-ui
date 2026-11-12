import type { EditProtection } from "./edit-guard";
import { toRaw } from "vue";
import { modelSubmissionBinding } from "./model-submission-binding";
import { modelRowBlocks } from "./model-row-blocks";
import { modelVoucherBinding } from "./model-voucher-binding";
import { defineDocumentPage, defineVoucherPage } from "./pages";
import { modelSubmission, type ModelVersions } from "./model-submission";
import { nodeMetadata } from "./model-node";
import type { ApplicationNode, ModelNode, ObjectShape } from "./reactive-model";
import type { ModelRuntime, RuntimeObject } from "./model-runtime";
import type {
  DocumentDefinition,
  DocumentSnapshot,
  DocumentArchive,
} from "./document";
import type { VoucherDefinition, VoucherArchive } from "./voucher";
import type { Fields, Column } from "./contracts";

type Value = Record<string, unknown>;
type Definition = DocumentDefinition<
  Value,
  unknown,
  unknown,
  unknown,
  unknown,
  Value,
  unknown
>;
type Voucher = VoucherDefinition<
  Value,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  Value,
  unknown
>;
type Ports = {
  [modelSubmission]: {
    protocol: "document" | "voucher";
    content: ObjectShape;
    versions?: ModelVersions<ObjectShape>;
    audit: ObjectShape;
  };
  get: {
    disabledReason?: string;
    run: Definition["adapter"]["query"] & Voucher["adapter"]["get"];
  };
  query?: { disabledReason?: string; run: Voucher["adapter"]["list"] };
  create?: {
    disabledReason?: string;
    run: NonNullable<Voucher["adapter"]["empty"]>;
  };
  clone?: {
    disabledReason?: string;
    run: NonNullable<Voucher["adapter"]["clone"]>;
  };
  submit: { disabledReason?: string; run: Definition["adapter"]["submit"] };
  approve?: {
    disabledReason?: string;
    run: NonNullable<Definition["adapter"]["approve"]>;
  };
  enable?: {
    disabledReason?: string;
    run: NonNullable<Definition["adapter"]["enable"]>;
  };
  disable?: {
    disabledReason?: string;
    run: NonNullable<Definition["adapter"]["disable"]>;
  };
  stage?: NonNullable<Definition["adapter"]["attachments"]>;
  reconcile?: Definition["reconcile"];
};
export function modelSubmissionPage(
  source: () => ModelNode | undefined,
  application: () => ApplicationNode,
  runtime: ModelRuntime,
  path: readonly string[],
  ancestors: readonly unknown[],
  onProtection?: (value: EditProtection) => void,
) {
  const initial = (source() as RuntimeObject)[nodeMetadata]
    .operations as unknown as Ports;
  const metadata = () =>
    current()?.[modelSubmission] ?? initial[modelSubmission];
  const current = () => {
    const candidate = (source() as RuntimeObject | undefined)?.[nodeMetadata]
      .operations as unknown as Ports | undefined;
    return candidate &&
      modelSubmission in candidate &&
      candidate[modelSubmission].protocol === initial[modelSubmission].protocol
      ? candidate
      : undefined;
  };
  const owner = () => application()[nodeMetadata].options.owner;
  const scope = () => JSON.stringify(owner());
  const fields = () =>
    runtime.fields(metadata().content) as unknown as Fields<Value>;
  const columns = () =>
    runtime.fields(metadata().audit).map((field) => ({
      key: field.key,
      label: field.label,
    })) as readonly Column<Value>[];
  const flatten = (value: Value, schema = metadata().content) =>
    runtime.flatten(schema, value);
  const snapshot = (
    value: DocumentSnapshot<Value, unknown, unknown, unknown, unknown>,
    node: ObjectShape = metadata().content,
  ) => ({
    ...value,
    values: flatten(value.values),
    eligible: {
      ...value.eligible,
      edit:
        value.eligible.edit &&
        !(node as RuntimeObject)[nodeMetadata].readOnly &&
        !!current()?.submit &&
        !current()?.submit.disabledReason,
      approve:
        value.eligible.approve &&
        !!current()?.approve &&
        !current()?.approve?.disabledReason,
      enable:
        value.eligible.enable &&
        !!current()?.enable &&
        !current()?.enable?.disabledReason,
      disable:
        value.eligible.disable &&
        !!current()?.disable &&
        !current()?.disable?.disabledReason,
    },
  });
  const archive = (
    value: DocumentArchive<Value, unknown, unknown, unknown, unknown, Value>,
  ) => ({
    ...value,
    official:
      value.official && snapshot(value.official, metadata().versions?.official),
    candidate:
      value.candidate &&
      snapshot(value.candidate, metadata().versions?.candidate),
    history: value.history.map((value) => snapshot(value)),
    audit: value.audit.map((row) => flatten(row, metadata().audit)),
  });
  const generations = new Map<keyof Ports, number>();
  async function read<T>(
    key: keyof Omit<Ports, typeof modelSubmission>,
    execute: (ports: Ports) => Promise<T>,
  ): Promise<T> {
    const generation = (generations.get(key) ?? 0) + 1;
    generations.set(key, generation);
    const op = current()?.[key],
      admittedScope = scope(),
      node = source();
    if (
      !op ||
      (typeof op === "object" && "disabledReason" in op && op.disabledReason) ||
      !owner()
    )
      throw Error("读取已撤销。");
    const value = await execute(current()!);
    if (
      generations.get(key) !== generation ||
      (typeof op === "object" && "disabledReason" in op && op.disabledReason) ||
      current()?.[key] !== op ||
      scope() !== admittedScope ||
      source() !== node
    )
      throw Error("读取已失效。");
    return value;
  }
  function write<K extends "submit" | "approve" | "enable" | "disable">(
    key: K,
  ) {
    return async (
      attempt: Parameters<NonNullable<Definition["adapter"][K]>>[0],
    ) => {
      const op = current()?.[key];
      if (!op || op.disabledReason || attempt.scope !== scope())
        return { status: "failure" as const, message: "操作已撤销。" };
      return op.run(attempt as never);
    };
  }
  const historyIdentities = new WeakMap<object, string>();
  const definition: Definition = {
    [modelSubmissionBinding]: {
      input: (value) => runtime.unflat(metadata().content, value, true),
    },
    resource: JSON.stringify([path, ancestors]),
    get title() {
      return source()?.[nodeMetadata].name ?? "资料";
    },
    get fields() {
      return fields();
    },
    get auditColumns() {
      return columns();
    },
    adapter: {
      query: async (input) => {
        const value = await read("get", (ports) => ports.get.run(input));
        const versions = metadata().versions;
        if (versions) {
          const clear = (node: ObjectShape) =>
            runtime.unflat(
              node,
              Object.fromEntries(
                runtime
                  .fields(node)
                  .map((field) => [
                    field.key,
                    field.type === "rows" ? [] : null,
                  ]),
              ),
              false,
            );
          runtime.adopt(
            versions.official,
            value.official?.values ?? clear(versions.official),
          );
          runtime.adopt(
            versions.candidate,
            value.candidate?.values ?? clear(versions.candidate),
          );
          const previous = new Map(
            versions.history.items.map((row) => [
              historyIdentities.get(toRaw(row)),
              row,
            ]),
          );
          versions.history.items = value.history.map((snapshot) => {
            const key = JSON.stringify([snapshot.identity, snapshot.state]);
            const row =
              previous.get(key) ?? versions.history[nodeMetadata].create();
            runtime.adopt(row, snapshot.values);
            historyIdentities.set(toRaw(row), key);
            return row;
          });
        }
        return archive(value);
      },
      submit: write("submit"),
      approve: write("approve"),
      enable: write("enable"),
      disable: write("disable"),
      get attachments() {
        const stage = current()?.stage;
        return stage
          ? {
              validate: (file: File) => stage.validate(file),
              stage: (
                attempt: Parameters<
                  NonNullable<Definition["adapter"]["attachments"]>["stage"]
                >[0],
              ) => {
                if (stage !== current()?.stage || attempt.scope !== scope())
                  return Promise.resolve({
                    status: "failure" as const,
                    message: "附件资格已撤销。",
                  });
                return stage.stage(attempt);
              },
              read: (
                input: Parameters<
                  NonNullable<Definition["adapter"]["attachments"]>["read"]
                >[0],
              ) => read("stage", (ports) => ports.stage!.read(input)),
            }
          : undefined;
      },
    },
    reconcile: (attempt) => {
      if (attempt.scope !== scope() || !current()?.reconcile)
        return Promise.resolve({ status: "unknown" as const });
      return current()!.reconcile!(attempt);
    },
  };
  const permissions = () => ({
    read: !!current()?.get && !current()?.get.disabledReason && !!owner(),
    write:
      !!current()?.submit && !current()?.submit.disabledReason && !!owner(),
    reconcile: !!current()?.reconcile && !!owner(),
  });
  if (metadata().protocol === "document")
    return defineDocumentPage(() => ({
      definition,
      onProtection,
      blocks: modelRowBlocks(metadata().content, runtime),
      permissions: permissions(),
    }));
  const voucher: Voucher = {
    [modelSubmissionBinding]: definition[modelSubmissionBinding],
    [modelVoucherBinding]: {
      create: () => current()?.create?.disabledReason,
      clone: () => current()?.clone?.disabledReason,
    },
    protocol: "submission",
    resource: definition.resource,
    get title() {
      return definition.title;
    },
    get fields() {
      return fields();
    },
    get auditColumns() {
      return columns();
    },
    adapter: {
      list: (input) => read("query", (ports) => ports.query!.run(input)),
      get: (input) =>
        read("get", async (ports) => {
          const value = (await ports.get.run(
            input,
          )) as unknown as VoucherArchive<
            Value,
            unknown,
            unknown,
            unknown,
            unknown,
            unknown,
            unknown,
            Value
          >;
          return {
            ...value,
            current: value.current && {
              ...value.current,
              values: flatten(value.current.values),
              eligible: {
                ...value.current.eligible,
                edit:
                  value.current.eligible.edit &&
                  !current()?.submit.disabledReason,
                clone: value.current.eligible.clone && !!current()?.clone,
                approve:
                  value.current.eligible.approve &&
                  !!current()?.approve &&
                  !current()?.approve?.disabledReason,
              },
            },
            history: value.history.map((row) => ({
              ...row,
              values: flatten(row.values),
            })),
            audit: value.audit.map((row) => flatten(row, metadata().audit)),
          };
        }),
      get empty() {
        return current()?.create
          ? (input: { scope: string }) => {
              if (current()?.create?.disabledReason || input.scope !== scope())
                throw Error(
                  current()?.create?.disabledReason ?? "新增资格已撤销。",
                );
              const value = current()!.create!.run(input);
              return { ...value, values: flatten(value.values) };
            }
          : undefined;
      },
      get clone() {
        return current()?.clone
          ? (
              input: Parameters<NonNullable<Voucher["adapter"]["clone"]>>[0],
            ) => {
              if (current()?.clone?.disabledReason || input.scope !== scope())
                throw Error(
                  current()?.clone?.disabledReason ?? "克隆资格已撤销。",
                );
              const value = current()!.clone!.run({
                ...input,
                source: {
                  ...input.source,
                  values: runtime.unflat(
                    metadata().content,
                    input.source.values,
                    false,
                  ),
                },
              });
              return { ...value, values: flatten(value.values) };
            }
          : undefined;
      },
      submit: definition.adapter.submit as Voucher["adapter"]["submit"],
      approve: definition.adapter.approve as Voucher["adapter"]["approve"],
      get attachments() {
        return definition.adapter.attachments;
      },
    },
    reconcile: definition.reconcile,
  };
  return defineVoucherPage(() => ({
    definition: voucher,
    onProtection,
    blocks: modelRowBlocks(metadata().content, runtime),
    permissions: permissions(),
  }));
}
