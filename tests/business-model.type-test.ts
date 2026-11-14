import { modelMetadata as meta, type BusinessModel } from "../src/model";

type Node = BusinessModel[string];
type ObjectNode = Extract<Node, { [meta]: { kind: "object" } }>;
type CollectionNode = Extract<Node, { [meta]: { kind: "collection" } }>;
type TextField = Extract<Node, { value: string }>;
type BooleanField = Extract<Node, { value: boolean }>;

const field: TextField = {
  value: "input",
  [meta]: { kind: "text", name: "Name" },
};
const record: ObjectNode = {
  name: field,
  id: field,
  operations: field,
  items: field,
  history: field,
  "external.code": field,
  [meta]: {
    kind: "object",
    name: "Any record",
    form: ["id", "name"],
    operations: {
      update: {
        async run() {
          field.value = "backend result";
        },
      },
      reconcile: { disabledReason: "Backend restriction", async run() {} },
    },
  },
};
const collection: CollectionNode = {
  items: [record],
  selected: record,
  draft: null,
  query: record,
  page: 1,
  pageSize: 20,
  total: 1,
  [meta]: {
    kind: "collection",
    name: "Any collection",
    list: ["name"],
    operations: {
      query: { async run() {} },
      create: { async run() {} },
      export: { async run() {} },
    },
  },
};
const aggregate: ObjectNode = {
  records: collection,
  description: field,
  nested: record,
  [meta]: {
    kind: "object",
    name: "Aggregate",
    form: ["nested", "records", "description"],
    operations: {},
  },
};
const owner = { ledger: "demo", operator: "demo", generation: "1" };
const model: BusinessModel = {
  arbitraryBusiness: aggregate,
  anotherBusiness: collection,
  [meta]: {
    kind: "application",
    name: "Application",
    brand: { productName: "Product", companyName: "Company" },
    owner,
    userPermissions: {
      owner,
      administrator: false,
      grants: [
        { node: aggregate, read: true },
        {
          node: collection,
          read: true,
          write: true,
          operations: { query: true, update: true },
        },
      ],
    },
    navigation: {
      current: aggregate,
      href: () => "/aggregate",
      visit(node) {
        model[meta].navigation.current = node;
      },
    },
    navigationProjection: [
      { key: "business", name: "Business", items: [{ node: aggregate }] },
    ],
    messages: [],
  },
};

// A completely different business tree needs no extra UI interface.
const otherBusiness: BusinessModel = {
  unrelatedName: record,
  [meta]: { ...model[meta], userPermissions: null },
};

const wrongText: TextField = {
  // @ts-expect-error text and decimal values are strings
  value: 42,
  [meta]: { kind: "text", name: "Wrong" },
};
const wrongBoolean: BooleanField = {
  // @ts-expect-error boolean values cannot be strings
  value: "false",
  [meta]: { kind: "boolean", name: "Wrong" },
};
const arbitraryAction: ObjectNode[typeof meta]["operations"] = {
  // @ts-expect-error arbitrary commands cannot become UI operations
  executeSql: { async run() {} },
};
const wrongCollectionAction: CollectionNode[typeof meta]["operations"] = {
  // @ts-expect-error record updates do not belong to the collection
  update: { async run() {} },
};
const wrongObjectAction: ObjectNode[typeof meta]["operations"] = {
  // @ts-expect-error collection queries do not belong to an object
  query: { async run() {} },
};
const oldRequestProtocol: ObjectNode[typeof meta]["operations"] = {
  update: {
    // @ts-expect-error operations do not require a frozen request parameter
    async run(_request: { requestId: string }) {},
  },
};
const componentConfiguration: BusinessModel = {
  ...model,
  // @ts-expect-error the application accepts model nodes, not component mappings
  component: () => null,
};
const layoutConfiguration: ObjectNode[typeof meta] = {
  ...record[meta],
  // @ts-expect-error layout is owned by the UI library
  layout: "tabs",
};
const invalidNavigation: BusinessModel[typeof meta]["navigation"] = {
  ...model[meta].navigation,
  // @ts-expect-error navigation refers to a model object, not a string command
  current: "arbitraryBusiness.records",
};
const invalidPermission: NonNullable<
  BusinessModel[typeof meta]["userPermissions"]
> = {
  owner,
  administrator: false,
  grants: [
    {
      node: record,
      read: true,
      operations: {
        // @ts-expect-error permissions cannot authorize arbitrary commands
        executeSql: true,
      },
    },
  ],
};

void [
  otherBusiness,
  wrongText,
  wrongBoolean,
  arbitraryAction,
  wrongCollectionAction,
  wrongObjectAction,
  oldRequestProtocol,
  componentConfiguration,
  layoutConfiguration,
  invalidNavigation,
  invalidPermission,
];
