import type { NavigationGroup } from "./shell";
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
