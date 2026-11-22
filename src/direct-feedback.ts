import {
  computed,
  shallowReactive,
  shallowRef,
  toRaw,
  watch,
  type Ref,
} from "vue";
import type { BusinessModel } from "./business-model";
import type { Node } from "./direct-model-runtime";

type Message = BusinessModel["messages"][number];
type Failure = { target: Node | null; text: string; key: symbol };
type Placement = { target: Node | null; text: string; consumed?: boolean };

export function directFeedback(
  model: () => BusinessModel,
  scope: Ref<string>,
  readable: (node: Node) => boolean,
  ancestors: (node: Node) => Node[],
  soleExecution: () => symbol | undefined,
) {
  const owners = new WeakMap<
    Message,
    {
      model: BusinessModel;
      scope: string;
      revision: string;
      execution?: symbol;
    }
  >();
  const overrides = shallowReactive(new WeakMap<Message, Placement>());
  const localTargets = shallowReactive(
    new Map<Node, { token: symbol; exact: boolean }>(),
  );
  const fallback = shallowRef<Failure>();
  watch(
    () =>
      model().messages.map(
        (message) =>
          [message, JSON.stringify([message.level, message.text])] as const,
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
            execution: soleExecution(),
          });
      }
    },
    { immediate: true, flush: "sync" },
  );

  function placement(message: Message) {
    const override = overrides.get(toRaw(message));
    return override?.text === message.text ? override : undefined;
  }
  function targetOf(message: Message) {
    return placement(message)?.target ?? message.target;
  }
  const notices = computed(() =>
    model().messages.filter((message) => {
      const owner = owners.get(toRaw(message));
      const target = targetOf(message);
      return (
        owner?.model === toRaw(model()) &&
        owner.scope === scope.value &&
        !!message.text.trim() &&
        !placement(message)?.consumed &&
        (!target || readable(target))
      );
    }),
  );
  function beneath(target: Node, node: Node) {
    return (
      toRaw(target) === toRaw(node) ||
      ancestors(target).some((ancestor) => toRaw(ancestor) === toRaw(node))
    );
  }
  function presentWith(node: Node, exact: boolean) {
    const key = toRaw(node);
    const placement = { token: Symbol(), exact };
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
  function presentation(node?: Node) {
    const key = node ? toRaw(node) : null;
    const failure = fallback.value;
    return {
      failure:
        failure &&
        (!failure.target || readable(failure.target)) &&
        location(failure.target) === key
          ? failure
          : undefined,
      messages: notices.value.filter(
        (message) => location(targetOf(message)) === key,
      ),
    };
  }
  function start() {
    fallback.value = undefined;
    return new Map(
      model().messages.map((message) => [
        toRaw(message),
        JSON.stringify([message.level, message.text]),
      ]),
    );
  }
  function changed(
    before: ReturnType<typeof start>,
    node: Node | undefined,
    execution: symbol,
  ) {
    return notices.value.filter((message) => {
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
    const selected = errors.at(-1) ?? warnings.at(-1);
    if (collapse)
      for (const message of [...errors, ...warnings])
        if (message !== selected) place(message, node ?? null, true);
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
    overrides.set(toRaw(message), { target, text: message.text, consumed });
  }
  function fail(target: Node | null) {
    fallback.value = {
      key: Symbol(),
      text: "操作失败，请检查业务信息后重试。",
      target,
    };
  }

  return {
    presentWith,
    capture,
    presentation,
    start,
    specific,
    discard,
    place,
    fail,
    clear: () => (fallback.value = undefined),
  };
}
