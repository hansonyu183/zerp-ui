import {
  defineDocument,
  type DocumentAdapter,
  type StageAttempt,
  type DocumentAttempt,
} from "../src/index";
type D = { name: string; enabled: boolean };
type I = { submission: string; revision: string };
type Owner = { archive: string };
type Handle = { receipt: string };
const adapter: DocumentAdapter<
  D,
  I,
  "open" | "approved",
  Owner,
  Handle,
  { event: string }
> = {
  query: async () => ({
    official: null,
    candidate: null,
    history: [],
    audit: [],
  }),
  submit: async (a) => {
    const revision: string = a.identity.revision;
    const receipt: string | undefined = a.attachments[0]?.receipt;
    void revision;
    void receipt;
    return { status: "success" };
  },
  approve: async (a) => {
    const operation: "approve" = a.operation;
    void operation;
    return { status: "success" };
  },
  attachments: {
    validate: () => undefined,
    stage: async (a) => ({
      status: "success",
      handle: { receipt: a.owner.archive },
    }),
    read: async () => ({ content: new Blob(), filename: "x" }),
  },
};
const valid = defineDocument({
  resource: "x",
  title: "x",
  fields: [{ key: "name", label: "名称", type: "text" }],
  auditColumns: [{ key: "event", label: "事件" }],
  adapter,
});
defineDocument<D, I, "open" | "approved", Owner, Handle, { event: string }>({
  ...valid,
  fields: [
    // @ts-expect-error boolean is not a decimal string
    { key: "enabled", label: "wrong", type: "decimal" },
  ],
});
defineDocument<
  D,
  number,
  "open" | "approved",
  Owner,
  Handle,
  { event: string }
>({
  ...valid,
  // @ts-expect-error numeric IDs cannot replace exact submission identity
  adapter,
});
const wrong: StageAttempt<I, string, Owner> = {
  id: "x",
  scope: "s",
  resource: "r",
  identity: { submission: "x", revision: "r1" },
  state: "open",
  operation: "stage",
  fileId: "f",
  file: new File([], "x"),
  // @ts-expect-error consumer owner is not a string
  owner: "bad",
};
void wrong;
const command: DocumentAttempt<D, I, string, Handle> = {
  id: "x",
  scope: "s",
  resource: "r",
  identity: { submission: "x", revision: "r1" },
  state: "open",
  // @ts-expect-error no arbitrary string commands
  operation: "execute",
};
void command;
