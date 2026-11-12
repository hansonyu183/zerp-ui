import { defineDocumentPage, defineVoucherPage } from "./pages";
import { modelSubmission } from "./model-submission";
import { nodeMetadata } from "./model-node";
import type { ApplicationNode, ModelNode, ObjectShape } from "./reactive-model";
import type { ModelRuntime, RuntimeObject } from "./model-runtime";
import type {
  DocumentDefinition,
  DocumentSnapshot,
  DocumentArchive,
  DocumentAttempt,
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
) {
  const initial = (source() as RuntimeObject)[nodeMetadata]
    .operations as unknown as Ports;
  const metadata = initial[modelSubmission];
  const current = () =>
    (source() as RuntimeObject | undefined)?.[nodeMetadata]
      .operations as unknown as Ports | undefined;
  const owner = () => application()[nodeMetadata].options.owner;
  const scope = () => JSON.stringify(owner());
  const fields = () =>
    runtime.fields(metadata.content) as unknown as Fields<Value>;
  const columns = () =>
    runtime
      .fields(metadata.audit)
      .map((field) => ({
        key: field.key,
        label: field.label,
      })) as readonly Column<Value>[];
  const flatten = (value: Value, schema = metadata.content) =>
    runtime.flatten(schema, value);
  const snapshot = (
    value: DocumentSnapshot<Value, unknown, unknown, unknown, unknown>,
  ) => ({
    ...value,
    values: flatten(value.values),
    eligible: {
      ...value.eligible,
      edit:
        value.eligible.edit &&
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
    official: value.official && snapshot(value.official),
    candidate: value.candidate && snapshot(value.candidate),
    history: value.history.map(snapshot),
    audit: value.audit.map((row) => flatten(row, metadata.audit)),
  });
  async function read<T>(
    key: keyof Omit<Ports, typeof modelSubmission>,
    execute: (ports: Ports) => Promise<T>,
  ): Promise<T> {
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
      const request = attempt as DocumentAttempt<
        Value,
        unknown,
        unknown,
        unknown
      >;
      return op.run(
        (request.operation === "submit"
          ? {
              ...request,
              input: runtime.unflat(metadata.content, request.input, true),
            }
          : request) as never,
      );
    };
  }
  const definition: Definition = {
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
      query: (input) =>
        read("get", async (ports) => archive(await ports.get.run(input))),
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
      const request =
        attempt.operation === "submit"
          ? {
              ...attempt,
              input: runtime.unflat(metadata.content, attempt.input, true),
            }
          : attempt;
      return current()!.reconcile!(request);
    },
  };
  const permissions = () => ({
    read: !!current()?.get && !current()?.get.disabledReason && !!owner(),
    write:
      !!current()?.submit && !current()?.submit.disabledReason && !!owner(),
    reconcile: !!current()?.reconcile && !!owner(),
  });
  if (metadata.protocol === "document")
    return defineDocumentPage(() => ({
      definition,
      permissions: permissions(),
    }));
  const voucher: Voucher = {
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
            },
            history: value.history.map((row) => ({
              ...row,
              values: flatten(row.values),
            })),
            audit: value.audit.map((row) => flatten(row, metadata.audit)),
          };
        }),
      get empty() {
        return current()?.create
          ? (input: { scope: string }) => {
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
              const value = current()!.clone!.run({
                ...input,
                source: {
                  ...input.source,
                  values: runtime.unflat(
                    metadata.content,
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
    permissions: permissions(),
  }));
}
