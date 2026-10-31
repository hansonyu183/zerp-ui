import {
  defineConfiguration,
  type ConfigurationAdapter,
  type ConfigurationAttempt,
  type Fields,
  type ConfigurationReconcileResult,
  type ConfigurationWriteResult,
} from "@zerp/ui";
export type Scenario =
  | "success"
  | "conflict"
  | "unknown-applied"
  | "unknown-not-applied"
  | "unknown-no-evidence"
  | "refresh-failure";
type Identity = { key: string; revision: string };
type Evidence = { request: string; outcome: "applied" | "not-applied" };
export function sample<D extends { name: string }>(
  resource: string,
  title: string,
  fields: Fields<D>,
  initial: D,
  scenario: () => Scenario,
  create = false,
) {
  let values = structuredClone(initial),
    revision = 1,
    failRead = false;
  const evidence = new Map<string, Evidence>();
  const adapter: ConfigurationAdapter<
    D,
    { keyword: string },
    { name: string; revision: string },
    Identity
  > = {
    async query({ filters }) {
      if (failRead) {
        failRead = false;
        throw new Error("合成刷新失败，请重试读取。");
      }
      return {
        items: values.name.includes(filters.keyword)
          ? [{ name: values.name, revision: String(revision) }]
          : [],
        total: values.name.includes(filters.keyword) ? 1 : 0,
      };
    },
    async get() {
      return {
        values: structuredClone(values),
        identity: { key: resource, revision: String(revision) },
      };
    },
    ...(create ? { empty: () => structuredClone(initial) } : {}),
    async save(
      a: ConfigurationAttempt<D, Identity>,
    ): Promise<ConfigurationWriteResult<Identity>> {
      const mode = scenario();
      if (
        mode === "conflict" ||
        (a.identity && a.identity.revision !== String(revision))
      )
        return {
          status: "failure",
          message: "合成修订冲突：请关闭并重新读取配置。",
        };
      if (mode === "unknown-not-applied") {
        evidence.set(a.id, { request: a.id, outcome: "not-applied" });
        return { status: "unknown" };
      }
      values = structuredClone(a.input);
      revision++;
      if (mode !== "unknown-no-evidence")
        evidence.set(a.id, { request: a.id, outcome: "applied" });
      if (mode.startsWith("unknown")) return { status: "unknown" };
      failRead = mode === "refresh-failure";
      return {
        status: "success",
        identity: { key: resource, revision: String(revision) },
      };
    },
  };
  return defineConfiguration<
    D,
    { keyword: string },
    { name: string; revision: string },
    Identity,
    Evidence
  >({
    resource,
    title,
    fields,
    filters: [{ key: "keyword", type: "text", label: "关键字" }],
    initialFilters: () => ({ keyword: "" }),
    columns: [
      { key: "name", label: "名称" },
      { key: "revision", label: "修订" },
    ],
    identity: (r) => ({ key: resource, revision: r.revision }),
    adapter,
    async reconcile(
      a,
    ): Promise<ConfigurationReconcileResult<Evidence, Identity>> {
      const proof = evidence.get(a.id);
      return proof
        ? {
            status: proof.outcome,
            attemptId: a.id,
            evidence: proof,
            identity: { key: resource, revision: String(revision) },
          }
        : { status: "unknown" };
    },
  });
}
export type Mapping = {
  name: string;
  route: { target: string; dimensions: string[] };
};
