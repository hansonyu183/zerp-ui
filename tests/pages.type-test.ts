import {
  defineDetailsPage,
  defineAccountPage,
  defineCrudPage,
  defineCrud,
  domainBlocks,
  type PageDefinition,
} from "@zerp/ui";
const details = {
  title: "事实",
  instance: "one",
  value: { amount: "1.0100" },
  groups: [],
};
defineDetailsPage(details);
const unsafePage: PageDefinition = {
  kind: "details",
  title: "unsafe",
  // @ts-expect-error Consumers cannot manufacture a page with arbitrary render callbacks.
  render: () => null,
};
// @ts-expect-error A getter is not a layout escape path either.
defineDetailsPage(() => ({ ...details, component: { render: () => null } }));
defineDetailsPage<{ amount: string }>({
  ...details,
  groups: [
    {
      key: "a",
      label: "金额",
      fields: [
        // @ts-expect-error Decimal string fields cannot be configured as booleans.
        { key: "amount", label: "金额", type: "boolean" },
      ],
    },
  ],
});
defineAccountPage({
  kind: "profile",
  title: "账户",
  values: { name: "a" },
  fields: [{ key: "name", label: "名称", type: "text" }],
  submit: (value) => value.name,
});
defineAccountPage({
  kind: "profile",
  title: "账户",
  values: { name: "a" },
  // @ts-expect-error Account forms retain field-value pairing.
  fields: [{ key: "name", label: "名称", type: "integer" }],
  submit: () => {},
});
type Draft = { name: string; settings: { count: number } };
const blocks = domainBlocks<Draft>();
blocks.fields({
  key: "settings",
  label: "设置",
  fields: [{ key: "count", label: "数量", type: "integer" }],
});
// @ts-expect-error A scalar cannot become a group of object fields.
blocks.fields({ key: "name", label: "名称", fields: [] });
blocks.fields({
  key: "settings",
  label: "设置",
  // @ts-expect-error Block fields retain the selected local value shape.
  fields: [{ key: "name", label: "名称", type: "text" }],
});
blocks.fields({
  key: "settings",
  label: "设置",
  fields: [],
  // @ts-expect-error Consumer components cannot be used as blocks.
  component: { render: () => null },
});
const definition = defineCrud<Draft, {}, { id: string }, string>({
  resource: "r",
  title: "r",
  fields: [],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "id", label: "编号" }],
  identity: (row) => row.id,
  actions: () => ["view"],
  adapter: {
    query: async () => ({ items: [], total: 0 }),
    get: async () => ({
      values: { name: "", settings: { count: 1 } },
      identity: "one",
    }),
    empty: () => ({ name: "", settings: { count: 1 } }),
    create: async () => ({ status: "success" }),
    save: async () => ({ status: "success" }),
  },
});
defineCrudPage({
  definition,
  permissions: { query: true, create: false, write: false },
});
defineCrudPage({
  definition,
  permissions: { query: true, create: false, write: false },
  // @ts-expect-error Initial rows remain paired with the list Adapter row type.
  initialRow: { id: 2 },
});
void unsafePage;

import {
  defineOperationPage,
  type OperationAction,
  type OperationDefinition,
  type OperationIntent,
  type OperationPreview,
} from "@zerp/ui";
type OperationModel = {
  [K in OperationAction]: {
    input: { note: string };
    preview: OperationPreview;
    evidence: { proof: number };
  };
};
declare const operationDefinition: OperationDefinition<
  OperationModel,
  { id: string },
  number
>;
declare const operationIntent: OperationIntent<OperationModel, { id: string }>;
defineOperationPage({
  title: "办理",
  definition: operationDefinition,
  intent: operationIntent,
  eligible: true,
  recoveryAllowed: true,
  onSettled: (value) => {
    const note: string = value.request.input.note;
    const proof: number = value.receipt.evidence.proof;
    void note;
    void proof;
  },
});
defineOperationPage({
  title: "办理",
  definition: operationDefinition,
  // @ts-expect-error The definition carries its exact action/input/evidence model through inference.
  intent: { ...operationIntent, input: { note: 12 } },
  eligible: true,
  recoveryAllowed: true,
});
defineOperationPage({
  title: "办理",
  definition: operationDefinition,
  // @ts-expect-error Identity does not widen through the operation page factory.
  intent: { ...operationIntent, identity: { id: 12 } },
  eligible: true,
  recoveryAllowed: true,
});
