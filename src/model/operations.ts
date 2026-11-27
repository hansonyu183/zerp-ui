// 按固定业务能力的声明顺序解析操作，同名项以最后一个定义为准。
import type {
  ListCollection,
  Node,
  ObjectNode,
  Operation,
} from "./business-model";

export type NodeOrCollection = Node | ListCollection;

type Operations = Record<string, Operation<never> | undefined>;

function ownOperations(node: NodeOrCollection) {
  return ("operations" in node ? node.operations : undefined) as
    Operations | undefined;
}

function capabilityOperations(
  node: ObjectNode,
): readonly (Operations | undefined)[] {
  return [
    node.document?.operations,
    node.workflow?.operations,
    node.processing?.operations,
    node.batch?.operations,
    node.report?.operations,
    node.output?.operations,
  ];
}

export function nodeOperations(
  node: NodeOrCollection,
  ownOnly = false,
): Operations {
  const own = ownOperations(node);
  return !ownOnly && "kind" in node && node.kind === "object"
    ? Object.assign({}, ...capabilityOperations(node), own)
    : (own ?? {});
}

export function nodeOperation(
  node: NodeOrCollection,
  action: string,
  ownOnly = false,
) {
  const own = ownOperations(node);
  const operation = own?.[action];
  if (own && Object.hasOwn(own, action)) return operation;
  if (ownOnly || !("kind" in node) || node.kind !== "object") return;
  // 与枚举一致，后声明的能力覆盖前面的同名操作。
  const groups = capabilityOperations(node);
  for (let i = groups.length - 1; i >= 0; i--) {
    const operations = groups[i];
    const candidate = operations?.[action];
    if (operations && Object.hasOwn(operations, action)) return candidate;
  }
}
