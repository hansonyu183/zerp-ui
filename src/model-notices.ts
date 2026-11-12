import type { ComputedRef, InjectionKey } from "vue";
import type { ModelNode } from "./reactive-model";
export type ModelNotice = {
  id: string;
  text: string;
  kind: "status" | "warning" | "error";
  persistent?: boolean;
  target?: ModelNode;
  identity?: unknown;
  action?: string;
};
export const modelNoticesKey: InjectionKey<{
  items: ComputedRef<readonly ModelNotice[]>;
  visit(node: ModelNode, identity?: unknown): void;
}> = Symbol("zerp.model.notices");
