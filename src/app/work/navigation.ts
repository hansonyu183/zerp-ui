// 定义侧栏和工具栏的呈现数据，并按模型顺序组织导航分区。
import { computed, toRaw } from "vue";
import type {
  DomainGroup,
  NavigationIcon,
  Workbench,
} from "../../model/business-model";
import { readable as nodeReadable, workbenchReadable } from "../nodes";
import { applicationReady, sessionScope, sessionState } from "../session";
import { workGroups } from "./structure";
import { collectionHref, homeHref } from "./work-router";

export type AccountIntent = "profile" | "change-password" | "sign-out";
export type NavigationGroup = Readonly<{
  key: string;
  caption: string;
  ungrouped?: boolean;
  items: readonly Readonly<{
    key: string;
    caption: string;
    href: string;
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
  if (!group.items.some((item) => item.section))
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

export function useWorkNavigation(workbench: () => Workbench | undefined) {
  const navigationIds = new WeakMap<object, number>();
  let nextNavigationId = 0;
  function domainEntry(domain: DomainGroup, path: string[], section?: string) {
    if (domain.hiddenFromNavigation) return [];
    const collections = domain.members.filter(nodeReadable);
    const target = collections[0];
    if (!target) return [];
    const raw = toRaw(target);
    if (!navigationIds.has(raw)) navigationIds.set(raw, ++nextNavigationId);
    return [
      {
        domain,
        target,
        collections,
        key: JSON.stringify([sessionScope.value, path, navigationIds.get(raw)]),
        section:
          section === undefined
            ? undefined
            : { key: JSON.stringify(path.slice(0, -1)), caption: section },
      },
    ];
  }
  const groups = computed(() =>
    workGroups.value.flatMap(({ member, domains }) => {
      if (!("kind" in member)) return [];
      const entries = domains.flatMap(({ domain, path, section }) =>
        domainEntry(domain, path, section?.label),
      );
      return entries.length ? [{ member, entries }] : [];
    }),
  );
  const navigationEntries = computed(() =>
    groups.value.flatMap((group) => group.entries),
  );
  const homeKey = computed(() =>
    JSON.stringify([sessionScope.value, "workbench"]),
  );
  const navigation = computed<NavigationGroup[]>(() => {
    if (sessionState.value !== "ready" || !applicationReady.value) return [];
    const items: NavigationGroup[] = groups.value.map(
      ({ member, entries }) => ({
        key: member.key,
        caption: member.label,
        ungrouped: member.kind === "domain",
        items: entries.map(({ domain, target, key, section }) => ({
          key,
          section,
          caption: domain.label,
          icon: domain.icon,
          href: collectionHref(target)!,
        })),
      }),
    );
    const home = workbench();
    if (home && workbenchReadable(home))
      items.unshift({
        key: homeKey.value,
        caption: "工作台",
        ungrouped: true,
        items: [
          {
            key: homeKey.value,
            caption: "工作台",
            icon: "home",
            href: homeHref.value,
          },
        ],
      });
    return items;
  });

  return { entries: navigationEntries, homeKey, navigation };
}
