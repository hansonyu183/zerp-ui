import type { DetailFields, DetailGroup, AppPageHandle } from "../src/index";
import type {
  Facts,
  Related,
  DetailsAdapter,
} from "../examples/details/adapters";
const fields: DetailFields<Facts, Related> = [
  {
    key: "reference",
    label: "引用",
    type: "reference",
    related: (ref) => ({ kind: "reference", id: ref.id }),
  },
  // @ts-expect-error boolean field cannot be a reference
  { key: "enabled", label: "错误", type: "reference" },
  // @ts-expect-error no unknown key
  { key: "absent", label: "错误", type: "text" },
  {
    key: "reference",
    label: "错误",
    type: "reference",
    // @ts-expect-error typed local intent cannot point to another intent kind
    related: () => ({ kind: "other", id: "one" }),
  },
  {
    key: "history",
    label: "子项",
    type: "records",
    rowKey: (row) => row.id,
    rowLabel: (row) => row.id,
    fields: [
      // @ts-expect-error child fields belong to the child record
      { key: "reference", label: "错误", type: "text" },
    ],
  },
];
const groups: DetailGroup<Facts, Related>[] = [
  { key: "facts", label: "事实", fields },
];
declare const handle: AppPageHandle;
const leave: Promise<boolean> = handle.requestLeave();
declare const adapter: DetailsAdapter;
// @ts-expect-error host adapter keeps its own typed scope/resource input
adapter.read({ scope: "one", id: 42 });
void groups;
void leave;
