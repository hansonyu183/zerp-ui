import {
  computed,
  shallowReactive,
  shallowRef,
  toRaw,
  watch,
  type Ref,
} from "vue";
import type { BusinessModel } from "./business-model";
import type { Node } from "./business-nodes";

type Message = BusinessModel["messages"][number];
type Failure = {
  target: Node | null;
  text: string;
  level: "error";
  order: number;
};
type Placement = { target: Node | null; revision: string; consumed?: boolean };

export function directFeedback(
  model: () => BusinessModel,
  scope: Ref<string>,
  readable: (node: Node) => boolean,
  ancestors: (node: Node) => Node[],
  needsResolution: (node: Node) => boolean,
  soleExecution: () => symbol | undefined,
) {
  const owners = new WeakMap<
    Message,
    {
      model: BusinessModel;
      scope: string;
      revision: string;
      order: number;
      execution?: symbol;
    }
  >();
  const overrides = shallowReactive(new WeakMap<Message, Placement>());
  const localTargets = shallowReactive(
    new Map<Node, { exact: boolean; blocked: () => boolean }>(),
  );
  const fallback = shallowRef<Failure>();
  let order = 0;
  watch(
    () =>
      model().messages.map(
        (message) => [message, revisionOf(message)] as const,
      ),
    (messages) => {
      for (const [message, revision] of messages) {
        const key = toRaw(message);
        const owner = owners.get(key);
        if (owner?.revision !== revision)
          owners.set(key, {
            model: owner?.model ?? toRaw(model()),
            scope: owner?.scope ?? scope.value,
            revision,
            order: ++order,
            execution: soleExecution(),
          });
      }
    },
    { immediate: true, flush: "sync" },
  );

  function placement(message: Message) {
    const override = overrides.get(toRaw(message));
    return override?.revision === revisionOf(message) ? override : undefined;
  }
  function targetOf(message: Message) {
    return placement(message)?.target ?? message.target;
  }
  const eligible = computed(() =>
    model().messages.filter((message) => {
      const owner = owners.get(toRaw(message));
      const target = targetOf(message);
      return (
        owner?.model === toRaw(model()) &&
        owner.scope === scope.value &&
        !!message.text.trim() &&
        (!target || readable(target))
      );
    }),
  );
  const notices = computed(() =>
    eligible.value.filter((message) => !placement(message)?.consumed),
  );
  function beneath(target: Node, node: Node) {
    return (
      toRaw(target) === toRaw(node) ||
      ancestors(target).some((ancestor) => toRaw(ancestor) === toRaw(node))
    );
  }
  function presentWith(node: Node, exact: boolean, blocked: () => boolean) {
    const key = toRaw(node);
    const placement = { exact, blocked };
    localTargets.set(key, placement);
    return () => {
      if (localTargets.get(key) === placement) localTargets.delete(key);
    };
  }
  function location(target: Node | null) {
    if (!target) return null;
    const key = toRaw(target);
    if (localTargets.has(key)) return key;
    for (const node of ancestors(target).slice().reverse()) {
      const placement = localTargets.get(toRaw(node));
      if (placement && !placement.exact) return toRaw(node);
    }
    return null;
  }
  function capture(node?: Node) {
    const target = location(node ?? null);
    const token = target && localTargets.get(target);
    return () => !target || localTargets.get(target) === token;
  }
  function resolution(message: Message) {
    const target = targetOf(message);
    if (
      message.blocking ||
      !target ||
      (message.level !== "warning" && message.level !== "error")
    )
      return false;
    const local = location(target);
    return (
      (local !== null && localTargets.get(local)?.blocked()) ||
      needsResolution(target)
    );
  }
  function reason(node?: Node) {
    const key = node ? toRaw(node) : null;
    return notices.value
      .filter(
        (message) => resolution(message) && location(targetOf(message)) === key,
      )
      .at(-1);
  }
  const blocking = computed(() =>
    notices.value.find((message) => message.blocking),
  );
  function acknowledge(message: Message) {
    for (const notice of notices.value)
      if (
        notice.blocking &&
        notice.level === message.level &&
        notice.text === message.text &&
        notice.target === message.target
      )
        place(notice, notice.target, true);
  }
  const passive = computed(() =>
    notices.value.filter(
      (message) => !message.blocking && !resolution(message),
    ),
  );
  const transient = computed(() => {
    const failure = fallback.value;
    let current: { message: Message | Failure; order: number } | undefined =
      failure && (!failure.target || readable(failure.target))
        ? { message: failure, order: failure.order }
        : undefined;
    for (const message of passive.value) {
      const order = owners.get(toRaw(message))!.order;
      if (!current || order > current.order) current = { message, order };
    }
    return current;
  });
  function dismissTransient() {
    const message = transient.value?.message;
    if (!message) return;
    if ("id" in message) place(message, message.target, true);
    else fallback.value = undefined;
  }
  watch(
    () => transient.value?.order,
    (order, _previous, onCleanup) => {
      if (order === undefined) return;
      const latest = transient.value?.message;
      for (const message of passive.value)
        if (message !== latest) place(message, message.target, true);
      if (fallback.value && fallback.value.order < order)
        fallback.value = undefined;
      const timer = setTimeout(dismissTransient, 3000);
      onCleanup(() => clearTimeout(timer));
    },
    { immediate: true },
  );
  function start() {
    fallback.value = undefined;
    return new Map(
      model().messages.map((message) => [toRaw(message), revisionOf(message)]),
    );
  }
  function changed(
    before: ReturnType<typeof start>,
    node: Node | undefined,
    execution: symbol,
  ) {
    return eligible.value.filter((message) => {
      const owner = owners.get(toRaw(message));
      const author = owner?.execution;
      return (
        before.get(toRaw(message)) !== owner?.revision &&
        (message.target
          ? (!author || author === execution) &&
            node &&
            beneath(message.target, node)
          : author === execution)
      );
    });
  }
  function specific(
    before: ReturnType<typeof start>,
    node: Node | undefined,
    execution: symbol,
    collapse: boolean,
  ) {
    const related = changed(before, node, execution);
    const errors = related.filter((message) => message.level === "error");
    const warnings = related.filter((message) => message.level === "warning");
    const selected =
      related.filter((message) => message.blocking).at(-1) ??
      errors.at(-1) ??
      warnings.at(-1);
    if (collapse)
      for (const message of [...errors, ...warnings])
        if (
          message !== selected &&
          !message.blocking &&
          !(selected?.blocking && resolution(message))
        )
          place(message, node ?? null, true);
    return selected;
  }
  function discard(
    before: ReturnType<typeof start>,
    target: Node | undefined,
    execution: symbol,
  ) {
    for (const message of changed(before, target, execution))
      place(message, target ?? null, true);
  }
  function place(message: Message, target: Node | null, consumed = false) {
    overrides.set(toRaw(message), {
      target,
      revision: revisionOf(message),
      consumed: consumed || placement(message)?.consumed,
    });
  }
  function fail(target: Node | null) {
    fallback.value = {
      level: "error",
      order: ++order,
      text: "操作失败，请检查业务信息后重试。",
      target,
    };
  }

  return {
    presentWith,
    capture,
    reason,
    blocking,
    acknowledge,
    transient,
    dismissTransient,
    start,
    specific,
    discard,
    place,
    fail,
    clear: () => (fallback.value = undefined),
  };
}

function revisionOf(message: Message) {
  return JSON.stringify([message.level, message.text, message.blocking]);
}
