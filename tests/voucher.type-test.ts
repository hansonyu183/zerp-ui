import {
  defineVoucher,
  type VoucherAdapter,
  type VoucherAttempt,
  type VoucherIdentity,
  type VoucherStageAttempt,
} from "../src/index";
type D = { name: string; amount: string; enabled: boolean };
type Submission = { id: string; payload: { amount: string } };
type Identity = VoucherIdentity<{ id: string }, string, Submission>;
const adapter: VoucherAdapter<
  D,
  { id: string },
  string,
  Submission,
  "open" | "approved",
  { owner: string },
  { handle: string },
  { event: string }
> = {
  list: async () => ({ items: [], hasMore: false }),
  get: async () => ({ current: null, history: [], audit: [] }),
  submit: async (a) => {
    const revision: string = a.identity.revision;
    const id: string = a.identity.voucher.id;
    const adopted: string | undefined = a.identity.submission?.payload.amount;
    void revision;
    void id;
    void adopted;
    // @ts-expect-error immutable submission identity
    if (a.identity.submission) a.identity.submission.id = "changed";
    // @ts-expect-error nested submission payload is immutable too
    if (a.identity.submission) a.identity.submission.payload.amount = "1";
    return { status: "success" };
  },
};
const valid = defineVoucher({
  resource: "documents",
  title: "Vouchers",
  fields: [{ key: "amount", type: "decimal", label: "金额" }],
  auditColumns: [{ key: "event", label: "事件" }],
  adapter,
});
defineVoucher<
  D,
  { id: string },
  string,
  Submission,
  "open" | "approved",
  { owner: string },
  { handle: string },
  { event: string }
>({
  ...valid,
  fields: [
    // @ts-expect-error boolean cannot carry a decimal string
    { key: "enabled", type: "decimal", label: "bad" },
  ],
});
defineVoucher<
  D,
  number,
  string,
  Submission,
  "open" | "approved",
  { owner: string },
  { handle: string },
  { event: string }
>({
  ...valid,
  // @ts-expect-error voucher identities are paired with the adapter
  adapter,
});
const identity: Identity = {
  voucher: { id: "one" },
  revision: "r2",
  submission: null,
};
const command: VoucherAttempt<
  D,
  { id: string },
  string,
  Submission,
  "open" | "approved",
  { handle: string }
> = {
  id: "attempt",
  scope: "s",
  resource: "d",
  identity,
  state: "open",
  // @ts-expect-error voucher has no arbitrary commands or version enable action
  operation: "enable",
};
void command;
const stage: VoucherStageAttempt<
  { id: string },
  string,
  Submission,
  string,
  { owner: string }
> = {
  id: "stage",
  scope: "s",
  resource: "d",
  identity,
  state: "open",
  operation: "stage",
  fileId: "f",
  file: new File([], "f"),
  // @ts-expect-error owner is consumer-defined and cannot be a string
  owner: "wrong",
};
void stage;
