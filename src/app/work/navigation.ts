// 定义侧栏和工具栏的呈现数据，并按模型顺序组织导航分区。
import type { RouteLocationRaw } from "vue-router";
import type { NavigationIcon } from "../../model/business-model";

export type AccountIntent = "profile" | "change-password" | "sign-out";
export type NavigationGroup = Readonly<{
  key: string;
  caption: string;
  ungrouped?: boolean;
  items: readonly Readonly<{
    key: string;
    caption: string;
    to: RouteLocationRaw;
    icon?: NavigationIcon;
    section?: Readonly<{ key: string; caption: string }>;
  }>[];
}>;

const navigationIcons: Record<NavigationIcon, string> = {
  home: "\u{F02DC}",
  catalog: "\u{F0219}",
  settings: "\u{F0493}",
  report: "\u{F0128}",
  voucher: "\u{F0214}",
  workflow: "\u{F0625}",
};

export function navigationGlyph(icon: NavigationIcon) {
  if (!Object.hasOwn(navigationIcons, icon))
    throw new Error(`未知导航图标：${icon}`);
  return navigationIcons[icon];
}

type Item = NavigationGroup["items"][number];
type Section = Readonly<{
  key?: string;
  caption?: string;
  items: readonly Item[];
}>;
/** Preserve consumer grouping and order; never infer semantics from names or codes. */
export function navigationSections(group: NavigationGroup): readonly Section[] {
  if (group.ungrouped || !group.items.some((item) => item.section))
    return [{ items: group.items }];
  const sections: { key?: string; caption?: string; items: Item[] }[] = [];
  for (const item of group.items) {
    const previous = sections.at(-1);
    if (previous && previous.key === item.section?.key)
      previous.items.push(item);
    else
      sections.push({
        key: item.section?.key,
        caption: item.section?.caption,
        items: [item],
      });
  }
  return sections;
}
