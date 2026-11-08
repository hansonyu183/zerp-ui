import type { NavigationGroup } from "./shell";

type Item = NavigationGroup["items"][number];
type Section = Readonly<{ caption?: string; items: readonly Item[] }>;
const limit = 12;
const words = new Intl.Segmenter("zh-CN", { granularity: "word" });

// Ignore a printed code prefix by shape; captions and destinations stay intact.
function name(item: Item) {
  return item.caption
    .trim()
    .replace(/^[A-Z][A-Z0-9]*\s+(?=\p{Script=Han})/u, "");
}
function firstWord(item: Item) {
  const word = [...words.segment(name(item))].find((part) => part.isWordLike);
  return word && Array.from(word.segment).length >= 2
    ? word.segment.toLocaleLowerCase("zh-CN")
    : "";
}
function commonName(items: readonly Item[]) {
  let prefix = Array.from(name(items[0]!));
  for (const item of items.slice(1)) {
    const other = Array.from(name(item));
    let length = 0;
    while (
      length < prefix.length &&
      prefix[length]!.toLocaleLowerCase("zh-CN") ===
        other[length]?.toLocaleLowerCase("zh-CN")
    )
      length++;
    prefix = prefix.slice(0, length);
  }
  return prefix.join("").trim();
}
function sections(items: readonly Item[], caption?: string): Section[] {
  if (items.length <= limit) return [{ caption, items }];
  const count = Math.ceil(items.length / limit);
  const size = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, index) => {
    const chunk = items.slice(index * size, (index + 1) * size);
    return {
      caption: `${name(chunk[0]!)} — ${name(chunk[chunk.length - 1]!)}`,
      items: chunk,
    };
  });
}

/** Presentation only: never inspect resource keys, routes or business metadata. */
export function navigationSections(group: NavigationGroup): readonly Section[] {
  if (group.ungrouped) return [{ items: group.items }];
  if (group.items.some((item) => item.section)) {
    const explicit = new Map<
      string | undefined,
      { caption?: string; items: Item[] }
    >();
    for (const item of group.items) {
      const key = item.section?.key;
      const section = explicit.get(key) ?? {
        caption: item.section?.caption,
        items: [],
      };
      section.items.push(item);
      explicit.set(key, section);
    }
    return [...explicit.values()];
  }
  if (group.items.length <= limit) return [{ items: group.items }];
  const candidates = new Map<string, Item[]>();
  for (const item of group.items) {
    const word = firstWord(item);
    const bucket = candidates.get(word) ?? [];
    bucket.push(item);
    candidates.set(word, bucket);
  }
  const buckets = new Map<string, Item[]>();
  for (const item of group.items) {
    const word = firstWord(item);
    const key = word && candidates.get(word)!.length > 1 ? word : "";
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }
  return [...buckets].flatMap(([key, items]) =>
    sections(items, key ? commonName(items) : undefined),
  );
}
