import type {
  BusinessModel,
  Workbench,
  RecordsNode,
  Collection,
} from "@zerp/ui/model";
declare const rows: RecordsNode;
declare const collection: Collection;
declare const workbench: Workbench;
declare const model: BusinessModel;
const complete = {
  information: rows,
  vouchers: rows,
  reports: rows,
  masters: rows,
  load: { disabled: false, async run() {} },
} satisfies Workbench;
// prettier-ignore
// @ts-expect-error Workbench is a fixed four-block structure.
const arbitrary = { ...workbench, columns: 3 } satisfies Workbench;
// prettier-ignore
// @ts-expect-error Workbench blocks are owned records, not independent collections.
const independent = { ...workbench, vouchers: collection } satisfies Workbench;
// prettier-ignore
// @ts-expect-error Workbench cannot become a global collection target.
model.navigation.current = workbench;
void [complete, arbitrary, independent];
