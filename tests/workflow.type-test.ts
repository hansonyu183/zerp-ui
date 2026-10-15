import {
  defineWorkflow,
  type WorkflowAttempt,
  type WorkflowAdapter,
} from "../src/index";
type Attempt = WorkflowAttempt<
  { id: string },
  string,
  number,
  { entity: "receipt" },
  { document: string }
>;
const attempt: Attempt = {
  id: "a",
  scope: "s",
  resource: "r",
  instance: { id: "i" },
  node: "n",
  revision: 7,
  reason: "",
  operation: "CREATE_CHILD",
  target: { entity: "receipt" },
};
// @ts-expect-error creation requires a typed target
const missing: Attempt = { ...attempt, target: undefined };
// @ts-expect-error arbitrary scripts/commands are not node operations
const script: Attempt = { ...attempt, operation: "RUN_SCRIPT" };
// @ts-expect-error revision is not coerced
const revision: Attempt = { ...attempt, revision: "7" };
const document: Attempt = {
  ...attempt,
  operation: "OPEN_DOCUMENT",
  // @ts-expect-error wrong document identity
  document: 1,
};
declare const adapter: WorkflowAdapter<
  { id: string },
  string,
  number,
  { entity: "receipt" },
  { document: string },
  { event: string }
>;
defineWorkflow({
  resource: "r",
  title: "t",
  adapter,
  auditColumns: [{ key: "event", label: "事件" }],
});
defineWorkflow({
  resource: "r",
  title: "t",
  adapter,
  // @ts-expect-error audit columns must match the paired adapter
  auditColumns: [{ key: "other", label: "错误" }],
});
void [attempt, missing, script, revision, document];
