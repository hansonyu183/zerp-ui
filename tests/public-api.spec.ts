import { expect, it } from "vitest";
import * as api from "../src/index";

it("offers exactly two public Vue components and no component block factory", () => {
  const components = Object.entries(api)
    .filter(
      ([, value]) =>
        value &&
        typeof value === "object" &&
        ("setup" in value || "render" in value),
    )
    .map(([name]) => name)
    .sort();
  expect(components).toEqual(["AppPage", "AuthPage"]);
  expect(api).not.toHaveProperty("configurationBlock");
  expect(api).not.toHaveProperty("snapshotPage");
  expect(api).not.toHaveProperty("renderBlock");
});
