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
) {
  const owners = new WeakMap<
    Message,
    { model: BusinessModel; scope: string }
  >();
  const overrides = shallowReactive(new WeakMap<Message, Placement>());
  const localTargets = shallowReactive(new Map<Node, symbol>());
  const fallback = shallowRef<Failure>();
  watch(
    () => model().messages.slice(),
    (messages) => {
      for (const message of messages) {
        const key = toRaw(message);
        if (!owners.has(key))
          owners.set(key, { model: toRaw(model()), scope: scope.value });
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
  function messagesFor(node: Node) {
    return notices.value.filter((message) => {
      const target = targetOf(message);
      return target && beneath(target, node);
    });
  }
  function presentWith(node: Node) {
    const key = toRaw(node);
    const token = Symbol();
    localTargets.set(key, token);
    return () => {
      if (localTargets.get(key) === token) localTargets.delete(key);
    };
  }
  function location(target: Node | null) {
    if (!target) return null;
    for (const node of [target, ...ancestors(target).slice().reverse()])
      if (localTargets.has(toRaw(node))) return toRaw(node);
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
  function specific(
    before: ReturnType<typeof start>,
    node: Node | undefined,
    untargeted: boolean,
  ) {
    const matches = notices.value.filter(
      (message) =>
        (message.level === "warning" || message.level === "error") &&
        (message.target ? node && beneath(message.target, node) : untargeted) &&
        before.get(toRaw(message)) !==
          JSON.stringify([message.level, message.text]),
    );
    return (
      matches.findLast((message) => message.level === "error") ?? matches.at(-1)
    );
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
    messagesFor,
    presentWith,
    capture,
    presentation,
    start,
    specific,
    place,
    fail,
    clear: () => (fallback.value = undefined),
  };
}
