import { defineBatchPage } from "./pages";
import { modelBatch, type ModelBatchOperation } from "./model-batch";
import { nodeMetadata } from "./model-node";
import type { ApplicationNode, ModelNode } from "./reactive-model";
import type { RuntimeObject } from "./model-runtime";
import type { OperationModel, OperationDefinition } from "./operation";
export function modelBatchPage(
  source: () => ModelNode | undefined,
  application: () => ApplicationNode,
  path: readonly string[],
  ancestors: readonly unknown[],
) {
  type Operation = ModelBatchOperation<OperationModel, unknown, unknown>;
  const first = (source() as RuntimeObject)[nodeMetadata]
    .operations as unknown as { [modelBatch]: true; executeBatch: Operation };
  const current = () =>
    (source() as RuntimeObject | undefined)?.[nodeMetadata]
      .operations as unknown as { executeBatch: Operation } | undefined;
  const admitted = first.executeBatch;
  const eligible = () =>
    !!source() &&
    current()?.executeBatch === admitted &&
    !admitted.disabledReason &&
    !!application()[nodeMetadata].options.owner;
  const definition: OperationDefinition<OperationModel, unknown, unknown> = {
    protocol: "operation",
    persistence: admitted.persistence,
    adapter: {
      ...admitted,
      execute: (request) => {
        if (!eligible()) throw Error("批量资格已撤销。");
        return admitted.run(request);
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
      entries: current()?.executeBatch.entries ?? [],
      persistence: admitted.journal,
      eligible: eligible(),
      recoveryAllowed: !!owner,
    };
  });
}
