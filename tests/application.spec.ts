import { expect, it } from "vitest";
import { applicationNavigation } from "../src/index";
import { applicationGroups, type ApplicationObject } from "../src/model";
const model: ApplicationObject = {
  kind: "object",
  name: "合成应用",
  properties: {
    customers: { kind: "object", name: "客户", target: "customers" },
    products: { kind: "object", name: "产品", target: "products" },
  },
  navigation: {
    groups: [
      { id: "empty", name: "空分组", modules: [] },
      { id: "masters", name: "基础资料", modules: ["products", "customers"] },
    ],
  },
};
it("projects module references in business order using consumer-owned links", () => {
  expect(
    applicationNavigation(model, {
      customers: { to: "/customers" },
      products: { to: "/products" },
    }),
  ).toEqual([
    {
      key: "masters",
      caption: "基础资料",
      ungrouped: undefined,
      items: [
        { key: "products", caption: "产品", to: "/products" },
        { key: "customers", caption: "客户", to: "/customers" },
      ],
    },
  ]);
});
it("rejects missing bindings and invalid or duplicated module references", () => {
  expect(() => applicationNavigation(model, {})).toThrow("未绑定模块");
  for (const modules of [["absent"], ["customers", "customers"]]) {
    expect(() =>
      applicationGroups({
        ...model,
        navigation: { groups: [{ id: "masters", name: "基础资料", modules }] },
      }),
    ).toThrow();
  }
});
it("does not silently drop a registered module from navigation", () => {
  expect(() =>
    applicationGroups({
      ...model,
      navigation: {
        groups: [{ id: "masters", name: "基础资料", modules: ["customers"] }],
      },
    }),
  ).toThrow("模块未投影：products");
});
