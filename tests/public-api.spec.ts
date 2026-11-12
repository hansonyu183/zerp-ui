import { expect, it } from "vitest";
import * as api from "../src/index";

it("offers only the model application and no retired assembly APIs", () => {
  const components = Object.entries(api)
    .filter(
      ([, value]) =>
        value &&
        typeof value === "object" &&
        ("setup" in value || "render" in value),
    )
    .map(([name]) => name)
    .sort();
  expect(components).toEqual(["BusinessApplication"]);
  for (const name of [
    "AppPage",
    "AuthPage",
    "defineCrud",
    "defineCrudPage",
    "defineBusinessPage",
    "applicationNavigation",
    "domainBlocks",
  ])
    expect(api).not.toHaveProperty(name);
  expect(api).not.toHaveProperty("configurationBlock");
  expect(api).not.toHaveProperty("snapshotPage");
  expect(api).not.toHaveProperty("renderBlock");
});
