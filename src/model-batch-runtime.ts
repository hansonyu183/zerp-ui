import type { InteractionAnswers } from "./collaboration";
import { clone } from "./clone";
import type { EditProtection } from "./edit-guard";
import { defineBatchPage } from "./pages";
import { modelBatch, type ModelBatchOperation } from "./model-batch";
import { nodeMetadata } from "./model-node";
import type { ApplicationNode, ModelNode } from "./reactive-model";
import type { RuntimeObject } from "./model-runtime";
import type {
  OperationModel,
  OperationDefinition,
  OperationIntent,
} from "./operation";
export function modelBatchPage(
  source: () => ModelNode | undefined,
  application: () => ApplicationNode,
  path: readonly string[],
  ancestors: readonly unknown[],
  onProtection?: (value: EditProtection) => void,
) {
  type Operation = ModelBatchOperation<
    OperationModel,
    unknown,
    unknown,
    readonly unknown[]
  >;
  const first = (source() as RuntimeObject)[nodeMetadata]
    .operations as unknown as { [modelBatch]: object; executeBatch: Operation };
  const current = () => {
    const candidate = (source() as RuntimeObject | undefined)?.[nodeMetadata]
      .operations as unknown as { executeBatch: Operation } | undefined;
    return candidate && modelBatch in candidate ? candidate : undefined;
  };
  const admitted = first.executeBatch;
  const eligible = () =>
    !!source() &&
    current()?.executeBatch === admitted &&
    !admitted.disabledReason &&
    !!application()[nodeMetadata].options.owner;
  const withContext = (intent: OperationIntent<OperationModel, unknown>) => {
    const answers = Reflect.get(intent, "answers") as
      InteractionAnswers | undefined;
    if (!answers || typeof answers !== "object" || Array.isArray(answers))
      throw Error("批次项目的原问题回答缺失。");
    return { ...intent, answers: clone(answers), ancestors: clone(ancestors) };
  };
  const definition: OperationDefinition<OperationModel, unknown, unknown> = {
    protocol: "operation",
    persistence: admitted.persistence as unknown as OperationDefinition<
      OperationModel,
      unknown,
      unknown
    >["persistence"],
    adapter: {
      ...(admitted as unknown as OperationDefinition<
        OperationModel,
        unknown,
        unknown
      >["adapter"]),
      prepare: (intent) => admitted.prepare(withContext(intent)),
      acceptsPreparation: (intent, prepared) =>
        "ancestors" in prepared &&
        JSON.stringify(prepared.ancestors) === JSON.stringify(ancestors) &&
        admitted.acceptsPreparation(
          withContext(intent),
          prepared as Parameters<typeof admitted.acceptsPreparation>[1],
        ),
      execute: (request) => {
        if (!eligible()) throw Error("批量资格已撤销。");
        return admitted.run(request as Parameters<typeof admitted.run>[0]);
      },
    },
  };
  return defineBatchPage(() => {
    const owner = application()[nodeMetadata].options.owner;
    return {
      title: source()?.[nodeMetadata].name ?? "批量办理",
      owner: {
        scope: JSON.stringify(owner),
        operator: owner?.operator ?? "",
        resource: JSON.stringify([path, ancestors]),
      },
      definition,
      onProtection,
      entries: current()?.executeBatch.entries ?? [],
      persistence: admitted.journal,
      eligible: eligible(),
      recoveryAllowed: !!owner,
    };
  });
}
