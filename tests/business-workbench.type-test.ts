import { modelMetadata as meta, type BusinessModel } from "../src/model";
type ObjectNode = Extract<
  BusinessModel[string],
  { [meta]: { kind: "object" } }
>;
type CollectionNode = Extract<
  BusinessModel[string],
  { [meta]: { kind: "collection" } }
>;
declare const information: ObjectNode;
declare const shortcuts: CollectionNode;
const workbench: ObjectNode = {
  information,
  shortcuts,
  [meta]: {
    kind: "object",
    name: "Overview",
    family: "workbench",
    operations: {},
    workbench: {
      information,
      vouchers: shortcuts,
      reports: shortcuts,
      documents: shortcuts,
      manageReports: shortcuts,
    },
  },
};
const collectionInformation: ObjectNode = {
  information: shortcuts,
  [meta]: {
    kind: "object",
    name: "Overview",
    family: "workbench",
    operations: {},
    workbench: {
      information: shortcuts,
      vouchers: shortcuts,
      reports: shortcuts,
      documents: shortcuts,
    },
  },
};
const invalid: ObjectNode = {
  // @ts-expect-error the fixed workbench family must identify its business roles
  [meta]: {
    kind: "object",
    name: "Missing roles",
    family: "workbench",
    operations: {},
  },
};
const arbitraryLayout: ObjectNode = {
  [meta]: {
    kind: "object",
    name: "Not a layout API",
    operations: {},
    // @ts-expect-error model objects cannot select arbitrary layouts
    layout: "cards",
  },
};
void [workbench, collectionInformation, invalid, arbitraryLayout];
