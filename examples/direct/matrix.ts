import {
  defineDirect,
  type DirectAction,
  type DirectDefinition,
  type Fields,
  type ReferenceAdapter,
  type ReferenceValue,
  type WriteResult,
} from "@zerp/ui";
export type Draft = {
  name: string;
  code: string;
  password: string;
  baseCurrency: string;
  startMonth: string;
  controlBook: boolean;
  dimensions: string[];
  enabled: boolean;
  parent: ReferenceValue | null;
  directory: ReferenceValue | null;
  roles: ReferenceValue[];
  employee: ReferenceValue | null;
  factor: string | null;
  carrierKind: string;
  internal: ReferenceValue | null;
  external: ReferenceValue | null;
  sort: number;
  rules: { name: string; children: { name: string }[] }[];
};
export type Filters = { keyword: string; directory: ReferenceValue | null };
export type Row = {
  directoryId: string;
  assignmentEditable: boolean;
  editable: boolean;
  id: string;
  revision: string;
  name: string;
  enabled: boolean;
  parent: string;
  factor: string | null;
};
export type Identity = { id: string; revision: string };
export const resourceCases = [
  ["acc/book", "账簿", "no-enable"],
  ["acc/subject", "科目", "save-enable"],
  ["aux/department", "部门", "tree"],
  ["aux/product-category", "产品类别", "tree"],
  ["aux/dictionary-type", "字典类型", "delete"],
  ["aux/dictionary-item", "字典项", "directory"],
  ["aux/income-expense-type", "收支类型", "tree"],
  ["app/user", "用户", "assignment"],
  ["app/role", "角色", "permissions"],
  ["aux/employee-category", "员工类别", "simple"],
  ["aux/position", "岗位", "simple"],
  ["aux/measurement-unit", "计量单位", "decimal"],
  ["aux/payment-method", "支付方式", "simple"],
  ["aux/asset-category", "资产类别", "simple"],
  ["aux/tax-information", "税务信息", "simple"],
  ["aux/operating-entity", "经营主体", "simple"],
  ["aux/employee", "员工", "reference"],
  ["aux/warehouse", "仓库", "reference"],
  ["aux/fund-account", "资金账户", "reference"],
  ["aux/vehicle", "车辆", "conditional"],
] as const;
export const catalog: ReferenceAdapter = {
  async search({ keyword, page, parent }) {
    const items = [
      {
        id: parent ? `${parent.id}-child-a` : "a",
        label: parent ? `${parent.label} 子项 A` : "合成可选 A",
        snapshot: { revision: "synthetic-a" },
      },
      {
        id: parent ? `${parent.id}-child-b` : "b",
        label: parent ? `${parent.label} 子项 B` : "合成可选 B",
        snapshot: { revision: "synthetic-b" },
      },
      { id: "blocked", label: "合成停用项", selectable: false },
    ].filter((v) => v.label.includes(keyword));
    return {
      items: items.slice((page - 1) * 20, page * 20),
      total: items.length,
    };
  },
  async resolve({ ids }) {
    return ids.map((id) => ({
      id,
      label: `合成已选 ${id}`,
      selectable: id !== "blocked",
    }));
  },
};
export function exampleDefinition(
  resource: (typeof resourceCases)[number][0],
): DirectDefinition<Draft, Filters, Row, Identity, { request: string }> {
  const spec = resourceCases.find((r) => r[0] === resource)!,
    kind = spec[2];
  const fields: Fields<Draft> = [
    { key: "name", label: "名称", type: "text", required: true },
    ...(kind === "no-enable"
      ? [
          {
            key: "baseCurrency" as const,
            type: "text" as const,
            label: "本位币",
          },
          {
            key: "startMonth" as const,
            type: "text" as const,
            label: "开始月份",
            readonly: true,
          },
          {
            key: "controlBook" as const,
            type: "boolean" as const,
            label: "控制账簿",
            mode: "edit" as const,
            readonly: true,
          },
        ]
      : []),
    ...(kind === "save-enable"
      ? [
          {
            key: "directory" as const,
            type: "reference" as const,
            label: "账簿",
            adapter: catalog,
            required: true,
          },
          {
            key: "dimensions" as const,
            type: "multi-enum" as const,
            label: "辅助维度",
            options: [
              { value: "customer", label: "合成客户维度" },
              { value: "department", label: "合成部门维度" },
            ],
          },
        ]
      : []),
    ...(kind === "assignment"
      ? [
          { key: "code" as const, type: "text" as const, label: "用户编码" },
          {
            key: "password" as const,
            type: "password" as const,
            label: "初始密码",
            mode: "create" as const,
          },
        ]
      : []),
    ...(["tree", "save-enable"].includes(kind)
      ? [
          {
            key: "parent" as const,
            label: "上级",
            type: "reference" as const,
            adapter: catalog,
            ...(kind === "save-enable" ? { parentKey: "directory" } : {}),
          },
        ]
      : []),
    ...(kind === "save-enable"
      ? [{ key: "enabled" as const, label: "启用", type: "boolean" as const }]
      : []),
    ...(kind === "directory"
      ? [
          {
            key: "directory" as const,
            label: "所属类型",
            type: "reference" as const,
            adapter: catalog,
            required: true,
          },
          { key: "sort" as const, label: "排序", type: "integer" as const },
        ]
      : []),
    ...(kind === "decimal"
      ? [
          {
            key: "factor" as const,
            label: "换算系数",
            type: "decimal" as const,
          },
        ]
      : []),
    ...(kind === "assignment"
      ? [
          {
            key: "employee" as const,
            label: "关联员工",
            type: "reference" as const,
            adapter: catalog,
          },
        ]
      : []),
    ...(["assignment", "permissions"].includes(kind)
      ? [
          {
            key: "roles" as const,
            label: kind === "assignment" ? "可分配角色" : "权限",
            type: "references" as const,
            adapter: catalog,
          },
        ]
      : []),
    ...(kind === "permissions"
      ? [
          {
            key: "rules" as const,
            label: "局部规则",
            type: "rows" as const,
            empty: () => ({ name: "", children: [] }),
            fields: [
              { key: "name" as const, label: "规则名", type: "text" as const },
              {
                key: "children" as const,
                label: "子规则",
                type: "rows" as const,
                empty: () => ({ name: "" }),
                fields: [
                  {
                    key: "name" as const,
                    label: "子规则名",
                    type: "text" as const,
                  },
                ],
              },
            ],
          },
        ]
      : []),
    ...(kind === "reference"
      ? [
          {
            key: "directory" as const,
            label: "关联资料",
            type: "reference" as const,
            adapter: catalog,
          },
        ]
      : []),
    ...(kind === "conditional"
      ? [
          {
            key: "carrierKind" as const,
            label: "承运归属",
            type: "enum" as const,
            options: [
              { value: "internal", label: "内部" },
              { value: "external", label: "外部" },
            ],
          },
          {
            key: "internal" as const,
            label: "内部单位",
            type: "reference" as const,
            adapter: catalog,
            when: { key: "carrierKind", equals: "internal" },
          },
          {
            key: "external" as const,
            label: "外部单位",
            type: "reference" as const,
            adapter: catalog,
            when: { key: "carrierKind", equals: "external" },
          },
        ]
      : []),
  ];
  let rows: Row[] = [
    {
      id: "synthetic-1",
      directoryId: "a",
      assignmentEditable: false,
      editable: true,
      revision: "1",
      name: `合成${spec[1]}`,
      enabled: true,
      parent: "合成上级",
      factor:
        kind === "decimal" ? "123456789012345678.123456789012345678" : null,
    },
  ];
  if (["directory", "save-enable", "assignment", "permissions"].includes(kind))
    rows.push({
      ...rows[0],
      id: "synthetic-2",
      directoryId: "b",
      assignmentEditable: true,
      editable: kind !== "permissions",
      name: `合成${spec[1]} B`,
    });
  let nextId = rows.length + 1;
  const drafts = new Map<string, Draft>();
  const empty = (context?: { scope: string; filters: Filters }): Draft => ({
    name: "",
    code: "synthetic-code",
    password: "",
    baseCurrency: "CNY",
    startMonth: "2026-01",
    controlBook: false,
    dimensions: [],
    enabled: true,
    parent: null,
    directory:
      context?.filters.directory ??
      (["directory", "save-enable"].includes(kind)
        ? { id: "a", label: "合成可选 A" }
        : null),
    roles: [],
    employee: null,
    factor: null,
    carrierKind: "internal",
    internal: null,
    external: null,
    sort: 0,
    rules: [],
  });
  function changed(
    identity: Identity | undefined,
    input: Draft | undefined,
  ): WriteResult {
    if (
      identity &&
      rows.find((r) => r.id === identity.id)?.revision !== identity.revision
    )
      return { status: "failure", message: "合成修订冲突，请重新读取。" };
    if (input) {
      const id = identity?.id ?? `synthetic-${nextId++}`;
      const existing = rows.find((r) => r.id === id);
      drafts.set(id, structuredClone(input));
      rows = [
        ...rows.filter((r) => r.id !== id),
        {
          id,
          directoryId: input.directory?.id ?? "a",
          assignmentEditable: existing?.assignmentEditable ?? true,
          editable: existing?.editable ?? true,
          revision: String(Number(identity?.revision ?? "0") + 1),
          name: input.name,
          enabled: input.enabled,
          parent: input.parent?.label ?? "",
          factor: input.factor,
        },
      ];
    }
    return { status: "success" };
  }
  return defineDirect<Draft, Filters, Row, Identity, { request: string }>({
    resource,
    title: `合成示例 · ${spec[1]}`,
    fields,
    filters: [
      { key: "keyword", label: "关键字", type: "text" },
      ...(kind === "directory" || kind === "save-enable"
        ? [
            {
              key: "directory" as const,
              label: kind === "directory" ? "所属类型筛选" : "账簿筛选",
              type: "reference" as const,
              adapter: catalog,
            },
          ]
        : []),
    ],
    initialFilters: () => ({
      keyword: "",
      directory:
        kind === "save-enable" ? { id: "a", label: "合成可选 A" } : null,
    }),
    columns: [
      { key: "name", label: "名称" },
      { key: "enabled", label: "启用", type: "boolean" },
      ...(kind === "decimal"
        ? [
            {
              key: "factor" as const,
              label: "换算系数",
              type: "decimal" as const,
            },
          ]
        : []),
    ],
    identity: (r) => ({ id: r.id, revision: r.revision }),
    actions: (r) => {
      if (!r.editable) return [];
      const actions: DirectAction[] = ["edit"];
      if (kind !== "no-enable" && kind !== "save-enable")
        actions.push(r.enabled ? "disable" : "enable");
      if (
        [
          "no-enable",
          "save-enable",
          "tree",
          "delete",
          "directory",
          "conditional",
          "reference",
        ].includes(kind)
      )
        actions.push("delete");
      return actions;
    },
    adapter: {
      empty,
      async query({ filters, page, pageSize }) {
        const items = rows.filter(
          (r) =>
            r.name.includes(filters.keyword) &&
            (!filters.directory || r.directoryId === filters.directory.id),
        );
        return {
          items: items.slice((page - 1) * pageSize, page * pageSize),
          total: items.length,
        };
      },
      async get({ identity }) {
        const row = rows.find((r) => r.id === identity.id)!;
        return {
          identity: { id: row.id, revision: row.revision },
          readonlyFields:
            kind === "assignment"
              ? row.assignmentEditable
                ? (["code"] as const)
                : (["code", "roles", "employee"] as const)
              : kind === "save-enable"
                ? (["directory"] as const)
                : [],
          values: drafts.get(row.id) ?? {
            ...empty(),
            name: row.name,
            enabled: row.enabled,
            factor: row.factor,
            directory: {
              id: row.directoryId,
              label: row.directoryId === "a" ? "合成可选 A" : "合成可选 B",
            },
            roles:
              kind === "assignment"
                ? [{ id: "blocked", label: "历史停用角色", selectable: false }]
                : [],
          },
        };
      },
      async create(a) {
        return changed(undefined, a.input);
      },
      async save(a) {
        return changed(a.identity, a.input);
      },
      async setEnabled(a) {
        const row = rows.find((r) => r.id === a.identity?.id);
        if (!row) return { status: "failure", message: "合成记录不存在" };
        const outcome = changed(a.identity, undefined);
        if (outcome.status === "success") {
          row.enabled = a.operation === "enable";
          row.revision = String(Number(row.revision) + 1);
        }
        return outcome;
      },
      async delete(a) {
        const outcome = changed(a.identity, undefined);
        if (outcome.status === "success")
          rows = rows.filter((r) => r.id !== a.identity?.id);
        return outcome;
      },
    },
  });
}
