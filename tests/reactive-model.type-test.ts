import {
  application,
  array,
  object,
  collection,
  text,
  boolean,
  decimal,
  type ModelInput,
  type ModelWrite,
} from "../src/model";
const customer = () =>
  object(
    "客户",
    {
      id: text("编号", { readOnly: true }),
      name: text("名称"),
      enabled: boolean("启用"),
      credit: decimal("额度"),
    },
    {
      identity: ["id"],
      operations: {
        update: {
          async run(request) {
            const id: string | null = request.identity.id;
            const credit: string | null = request.input.credit;
            void [id, credit];
            return { status: "success" };
          },
        },
      },
    },
  );
const customers = collection("客户", customer, {
  operations: {
    query: {
      async run() {
        return { items: [customer()], total: 1 };
      },
    },
  },
});
object(
  "错误操作",
  {},
  {
    operations: {
      // @ts-expect-error unknown operations are forbidden
      erase: {
        async run() {
          return { status: "success" };
        },
      },
    },
  },
);
collection("错误层级", customer, {
  operations: {
    // @ts-expect-error update is a record operation
    update: {
      async run() {
        return { status: "success" };
      },
    },
  },
});
object(
  "错误模板",
  {},
  {
    // @ts-expect-error no templates
    template: "<div />",
  },
);
// @ts-expect-error field identity must exist
object("错误身份", { id: text("编号") }, { identity: ["missing"] });
type Input = ModelInput<ReturnType<typeof customer>>;
const input: Input = { name: "合成", enabled: false, credit: "0.00" };
const update: ModelWrite<{ name: string }, { id: string }> = {
  // @ts-expect-error wrong result value
  async run() {
    return {
      status: "success",
      snapshot: { value: { name: 1 }, identity: { id: "a" }, concurrency: "1" },
    };
  },
};
void [application, customers, input, update];

const readonlyInput: Input = {
  // @ts-expect-error read-only fields cannot enter input
  id: "a",
  name: "n",
  enabled: false,
  credit: "0",
};
void readonlyInput;

const query = object("条件", { search: text("搜索") });
collection("精确查询输入", customer, {
  operations: {
    query: {
      input: query,
      async run(context) {
        const search: string | null = context.input.search;
        // @ts-expect-error input comes from this operation's input node
        void context.input.password;
        void search;
        return { items: [], total: 0 };
      },
    },
  },
});
const wrongEvidence: ModelWrite<{ name: string }, { id: string }> = {
  async run() {
    return { status: "unknown" };
  },
  // @ts-expect-error evidence must carry the matching record and identity
  async reconcile(request) {
    return {
      status: "applied",
      requestId: request.requestId,
      evidence: { value: { name: "n" }, identity: { id: 1 }, concurrency: "1" },
    };
  },
};
const invalidField: import("../src/model").ModelWriteResult<
  { name: string },
  { id: string }
> = {
  status: "failure",
  message: "校验",
  // @ts-expect-error errors cannot address unrelated fields
  fields: [{ field: "password", message: "校验" }],
};
collection("新增最终身份", customer, {
  operations: {
    create: {
      // @ts-expect-error successful create requires authoritative final identity and concurrency
      async run() {
        return { status: "success" };
      },
    },
  },
});
const isolated = object(
  "独立只读对象",
  { value: text("值") },
  {
    operations: {
      get: {
        async run() {
          return { value: { value: "x" }, identity: {}, concurrency: "1" };
        },
      },
    },
  },
);
const parent = object("父", {
  name: text("名称"),
  children: customers,
  isolated,
});
type ParentInput = ModelInput<typeof parent>;
const parentInput: ParentInput = { name: "n" };
// @ts-expect-error independent children do not enter a parent submission
const mixedInput: ParentInput = { name: "n", children: [] };
void [wrongEvidence, invalidField, parentInput, mixedInput];

const foreignContact = () =>
  object(
    "联系人",
    { id: text("编号", { readOnly: true }), name: text("姓名") },
    {
      identity: ["id"],
      operations: {
        update: {
          async run(
            _request: import("../src/model").ModelRequest<
              { name: string | null },
              { id: string | null },
              readonly [{ foreign: string }]
            >,
          ) {
            return { status: "success" };
          },
        },
      },
    },
  );
const foreignChildren = {
  id: text("编号"),
  contacts: collection("所属联系人", foreignContact),
};
// @ts-expect-error nested contact ancestor must be this parent's actual identity
object("错误祖先配对", foreignChildren, {
  identity: ["id"],
  operations: {
    update: {
      async run() {
        return { status: "success" };
      },
    },
  },
});

const arrayValues = object("值数组", {
  tags: array("标签", () => text("标签值")),
  shared: array("共享标签", () => text("标签值"), [], { readOnly: true }),
});
const writableArrays: ModelInput<typeof arrayValues> = { tags: ["A"] };
const forbiddenArrays: ModelInput<typeof arrayValues> = {
  tags: [],
  // @ts-expect-error Read-only arrays are not part of parent writes.
  shared: ["A"],
};
void [writableArrays, forbiddenArrays];

// API-produced dynamic members retain unknown values for business decoding;
// they must not become an impossible Record<string, never> callback contract.
const dynamicMembers: Record<string, import("../src/model").ModelNode> = {
  amount: decimal("动态金额"),
};
const dynamicRecord = object("动态 API 对象", dynamicMembers, {
  operations: {
    get: {
      async run() {
        return { value: { amount: "123.45" }, identity: {}, concurrency: "1" };
      },
    },
    update: {
      async run(request) {
        const amount: unknown = request.input.amount;
        void amount;
        return { status: "success" };
      },
    },
  },
});
void dynamicRecord;

const dynamicFields: ModelWrite<Record<string, unknown>, { id: string }> = {
  async run() {
    return {
      status: "failure",
      message: "嵌套字段错误",
      fields: [
        { field: ["contact", "mobile_no"], message: "手机无效" },
        { field: "contact.mobile_no", message: "独立含点键错误" },
      ],
    };
  },
};
void dynamicFields;

const staticField: import("../src/model").ModelFieldPath<{
  contact: { phone: string };
  "contact.phone": string;
}> = ["contact", "phone"];
// @ts-expect-error static nested paths stay scoped to declared fields
const wrongStaticField: import("../src/model").ModelFieldPath<{
  contact: { phone: string };
}> = ["contact", "password"];
void [staticField, wrongStaticField];

const projectionMembers = {
  id: text("编号", { readOnly: true }),
  "values.name": text("字面字段"),
  values: object("资料", { name: text("名称"), amount: decimal("金额") }),
};
object("独立列表", projectionMembers, {
  form: ["values"],
  list: ["id", "values.name", ["values", "name"], ["values", "amount"]],
});
// @ts-expect-error static nested list fields stay within the declared model
object("错误嵌套列表", projectionMembers, {
  list: [["values", "missing"]],
});
// @ts-expect-error scalar nodes have no list descendants
object("错误标量后代", projectionMembers, {
  list: [["id", "name"]],
});
// @ts-expect-error dotted strings remain literal keys rather than nested paths
object("错误字面字段", projectionMembers, {
  list: ["values.amount"],
});
