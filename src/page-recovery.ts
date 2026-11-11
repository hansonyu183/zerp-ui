import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { probePageRecovery, type PageDefinition } from "./pages";
/** Discover unresolved originals without loading otherwise unopened collections. */
export function usePageRecovery(
  entries: () => readonly { key: string; page?: PageDefinition }[],
  scope: () => string,
  active: () => boolean = () => true,
) {
  const required = shallowRef<ReadonlySet<string>>(new Set()),
    probing = ref(false);
  let generation = 0,
    alive = true;
  watch(
    () => [
      scope(),
      active(),
      ...entries().flatMap((entry) => [entry.key, entry.page]),
    ],
    async (next, previous) => {
      if (
        previous &&
        next.length === previous.length &&
        next.every((value, index) => value === previous[index])
      )
        return;
      const epoch = ++generation;
      required.value = new Set();
      probing.value = active();
      if (!active()) return;
      const owner = scope();
      const keys = await Promise.all(
        entries().map(async (entry) => {
          try {
            return (await entry.page?.[probePageRecovery]?.(owner))
              ? entry.key
              : undefined;
          } catch {
            return entry.key;
          } // Mount the real runtime so a broken journal remains visibly blocked.
        }),
      );
      if (!alive || epoch !== generation) return;
      required.value = new Set(
        keys.filter((key): key is string => key !== undefined),
      );
      await nextTick();
      if (alive && epoch === generation) probing.value = false;
    },
    { immediate: true, flush: "sync" },
  );
  onBeforeUnmount(() => {
    alive = false;
    generation++;
  });
  return { required, probing };
}
