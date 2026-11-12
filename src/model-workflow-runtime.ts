import { shallowRef } from "vue";
import { defineWorkflowPage } from "./pages";
import { modelWorkflow } from "./model-workflow";
import { nodeMetadata } from "./model-node";
import type { ApplicationNode, ModelNode, ObjectShape } from "./reactive-model";
import type { ModelRuntime, RuntimeObject } from "./model-runtime";
import type {
  WorkflowDefinition,
  WorkflowAction,
  WorkflowInstance,
} from "./workflow";
import type { Column } from "./contracts";
type Value = Record<string, unknown>;
type Definition = WorkflowDefinition<
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  Value,
  unknown
>;
const keys = {
  CREATE_CHILD: "createChild",
  APPROVE_CHILD: "approveChild",
  REJECT_CHILD: "rejectChild",
  RETRY_CHILD: "retryChild",
  CANCEL_CHILD: "cancelChild",
  OPEN_VOUCHER: "openVoucher",
} as const;
type Ports = {
  [modelWorkflow]: { audit: ObjectShape };
  query: { disabledReason?: string; run: Definition["adapter"]["list"] };
  get: { disabledReason?: string; run: Definition["adapter"]["get"] };
  audit: { disabledReason?: string; run: Definition["adapter"]["audit"] };
  reconcile?: Definition["reconcile"];
} & Partial<
  Record<
    (typeof keys)[keyof typeof keys],
    {
      disabledReason?: string;
      run: Definition["adapter"]["act"];
      target?(value: unknown): { node: ModelNode; identity?: unknown };
    }
  >
>;
export function modelWorkflowPage(
  source: () => ModelNode | undefined,
  application: () => ApplicationNode,
  runtime: ModelRuntime,
  path: readonly string[],
  ancestors: readonly unknown[],
) {
  const initial = (source() as RuntimeObject)[nodeMetadata]
    .operations as unknown as Ports;
  const current = () =>
    (source() as RuntimeObject | undefined)?.[nodeMetadata]
      .operations as unknown as Ports | undefined;
  const scope = () => JSON.stringify(application()[nodeMetadata].options.owner);
  const instance =
    shallowRef<WorkflowInstance<unknown, unknown, unknown, unknown, unknown>>();
  const allowed = (key: keyof Ports) =>
    !!current()?.[key] &&
    !(current()![key] as { disabledReason?: string }).disabledReason &&
    !!application()[nodeMetadata].options.owner;
  async function read<T>(
    key: "query" | "get" | "audit",
    execute: (ports: Ports) => Promise<T>,
  ) {
    const op = current()?.[key],
      owner = scope();
    if (!allowed(key)) throw Error("流程读取已撤销。");
    const result = await execute(current()!);
    if (!allowed(key) || current()?.[key] !== op || owner !== scope())
      throw Error("流程读取已失效。");
    return result;
  }
  const definition: Definition = {
    resource: JSON.stringify([path, ancestors]),
    get title() {
      return source()?.[nodeMetadata].name ?? "流程";
    },
    get auditColumns() {
      return runtime
        .fields(initial[modelWorkflow].audit)
        .map((field) => ({
          key: field.key,
          label: field.label,
        })) as readonly Column<Value>[];
    },
    adapter: {
      list: (input) => read("query", (ports) => ports.query.run(input)),
      get: async (input) => {
        const result = await read("get", (ports) => ports.get.run(input));
        instance.value = result;
        return result;
      },
      audit: (input) =>
        read("audit", async (ports) =>
          (await ports.audit.run(input)).map((row) =>
            Object.fromEntries(
              runtime.fields(initial[modelWorkflow].audit).map((field) => {
                let value: unknown = row;
                for (const key of JSON.parse(field.key) as string[])
                  value =
                    value && typeof value === "object"
                      ? Reflect.get(value, key)
                      : undefined;
                return [field.key, value];
              }),
            ),
          ),
        ),
      act: (attempt) => {
        const key = keys[attempt.operation],
          op = current()?.[key];
        if (!op || !allowed(key) || attempt.scope !== scope())
          return Promise.resolve({
            status: "failure",
            message: "流程操作已撤销。",
          });
        return op.run(attempt);
      },
    },
    reconcile: (attempt) =>
      attempt.scope === scope() && current()?.reconcile
        ? current()!.reconcile!(attempt)
        : Promise.resolve({ status: "unknown" }),
  };
  return defineWorkflowPage(() => ({
    definition,
    permissions: {
      read: allowed("query") && allowed("get"),
      audit: allowed("audit"),
      reconcile: !!current()?.reconcile,
      actions: (Object.keys(keys) as WorkflowAction[]).filter((action) =>
        allowed(keys[action]),
      ),
      targets:
        instance.value?.nodes.flatMap((node) =>
          node.targets.map((target) => target.key),
        ) ?? [],
    },
    onOpenVoucher: (value) => {
      const target = current()?.openVoucher?.target?.(value);
      if (target)
        application()[nodeMetadata].options.navigation.visit(
          target.node,
          target.identity,
        );
    },
  }));
}
