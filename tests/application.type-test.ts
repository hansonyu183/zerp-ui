import { applicationNavigation } from "./fixtures/assembly";
import type { ApplicationObject } from "../src/business-type";
const model = {
  kind: "object",
  name: "合成应用",
  properties: {
    customers: { kind: "object", name: "客户", target: "customers" },
  },
  navigation: {
    groups: [{ id: "masters", name: "基础资料", modules: ["customers"] }],
  },
} as const satisfies ApplicationObject;
applicationNavigation(model, { customers: { to: "/customers" } });
// @ts-expect-error a registered module requires its own binding
applicationNavigation(model, {});
// @ts-expect-error a misspelt module is not a transport binding
applicationNavigation(model, { custmoers: { to: "/customers" } });
