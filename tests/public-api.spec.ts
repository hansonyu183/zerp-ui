import { expect, it } from "vitest";
import * as api from "../src/index";

it("offers the model entrance alongside the not-yet-retired page entrances and no component block factory", () => {
  const components = Object.entries(api)
    .filter(
      ([, value]) =>
        value &&
        typeof value === "object" &&
        ("setup" in value || "render" in value),
    )
    .map(([name]) => name)
    .sort();
  expect(components).toEqual(["AppPage", "AuthPage", "BusinessApplication"]);
  expect(api).not.toHaveProperty("configurationBlock");
  expect(api).not.toHaveProperty("snapshotPage");
  expect(api).not.toHaveProperty("renderBlock");
});
