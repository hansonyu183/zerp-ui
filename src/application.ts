import { applicationGroups, type ApplicationObject } from "./model";
import type { NavigationGroup } from "./shell";

/** Consumer-owned transport bindings; the business model contains no routes. */
export function applicationNavigation<const T extends ApplicationObject>(
  model: T,
  bindings: Readonly<
    Record<
      Extract<keyof T["properties"], string>,
      Omit<NavigationGroup["items"][number], "key" | "caption">
    >
  >,
): NavigationGroup[] {
  return applicationGroups(model).map((group) => ({
    key: group.id,
    caption: group.name,
    ungrouped: group.ungrouped,
    items: group.modules.map((module) => {
      const binding = Object.hasOwn(bindings, module.id)
        ? bindings[module.id as Extract<keyof T["properties"], string>]
        : undefined;
      if (!binding) throw Error(`未绑定模块：${module.id}`);
      return { ...binding, key: module.id, caption: module.name };
    }),
  }));
}
