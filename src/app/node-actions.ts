// 动态按钮按模型顺序枚举操作，执行时按名称复核当前回调。
import type {
  ObjectNode,
  Operation,
  RecordsNode,
} from "../model/business-model";
import { readable } from "./nodes";
import { nodeOperation, type NodeOrCollection } from "../model/operations";
import { runWithFeedback } from "./feedback";

export function runOperation(
  node: NodeOrCollection,
  action: string,
  ownOnly = false,
) {
  const operation = nodeOperation(node, action, ownOnly) as
    Operation<ObjectNode | RecordsNode | void> | undefined;
  if (!operation || operation.disabled) return;

  const input =
    "kind" in node && (node.kind === "object" || node.kind === "records")
      ? node
      : undefined;
  const identity = "identity" in node ? node.identity : node.key;
  return runWithFeedback(
    node,
    () => operation.run(input),
    () =>
      ("identity" in node ? node.identity : node.key) === identity &&
      nodeOperation(node, action, ownOnly) === operation &&
      readable(node),
    node,
  );
}
