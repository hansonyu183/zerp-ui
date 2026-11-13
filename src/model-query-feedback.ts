import { redactSecrets } from "./editor-values";
import { message } from "./clone";
import { clone } from "./clone";
import type { Interaction } from "./collaboration";
import type { ModelReportFeedback } from "./model-report-binding";
import type {
  ApplicationNode,
  ModelLocalIntent,
  ObjectShape,
} from "./reactive-model";
import type { ModelRuntime } from "./model-runtime";
import { nodeMetadata } from "./model-node";
type Values = Record<string, unknown>;

/** Result-owned local intents; final business writes have no entry point here. */
export function modelQueryFeedback(
  interactions: readonly Interaction<ModelLocalIntent<Values>>[],
  input: () => ObjectShape | undefined,
  application: () => ApplicationNode,
  runtime: ModelRuntime,
  active: () => boolean,
): ModelReportFeedback {
  let targets = new Map<string, ModelLocalIntent<Values>>();
  function pack(items: typeof interactions): readonly Interaction<string>[] {
    targets = new Map();
    const register = (target: ModelLocalIntent<Values>) => {
      const token = crypto.randomUUID();
      targets.set(token, target);
      return token;
    };
    return items.map((item): Interaction<string> => {
      switch (item.kind) {
        case "menu":
        case "tree":
          return {
            ...item,
            items: item.items.map((entry) => ({
              ...entry,
              target: register(entry.target),
              children: entry.children?.map((child) => ({
                ...child,
                target: register(child.target),
              })),
            })),
          };
        case "related":
        case "download":
          return { ...item, target: register(item.target) };
        default:
          return item;
      }
    });
  }
  let items = pack(interactions);
  return {
    collaboration: {
      async change(context) {
        if (!active() || !application()[nodeMetadata].options.owner)
          throw Error("查询交互已失效，请重新查询。");
        if (context.event !== "action")
          return { value: context.value, interactions: items };
        const target = context.target && targets.get(context.target);
        if (!target) throw Error("查询交互已失效，请重新查询。");
        const node = input();
        const owner = clone(application()[nodeMetadata].options.owner!);
        const current = () =>
          active() &&
          !context.signal.aborted &&
          input() === node &&
          context.target &&
          targets.get(context.target) === target &&
          JSON.stringify(application()[nodeMetadata].options.owner) ===
            JSON.stringify(owner);
        try {
          if (target.kind === "related") {
            application()[nodeMetadata].options.navigation.visit(
              target.node,
              target.identity,
            );
          } else if (target.kind === "download") {
            const file = await target.read({ owner, signal: context.signal });
            if (!current()) return { value: context.value };
            const url = URL.createObjectURL(file.content);
            const anchor = document.createElement("a");
            try {
              anchor.href = url;
              anchor.download = file.filename;
              anchor.click();
            } finally {
              URL.revokeObjectURL(url);
            }
          } else {
            const result = await target.run({
              owner,
              input: node ? runtime.unflat(node, context.value, false) : {},
              answers: clone(context.answers),
              signal: context.signal,
            });
            if (!current()) return { value: context.value };
            items = pack(result.interactions ?? []);
            return {
              value: node ? runtime.flatten(node, result.value) : {},
              interactions: items,
            };
          }
          return { value: context.value, interactions: items };
        } catch (cause) {
          if (!current()) return { value: context.value };
          throw Error(
            redactSecrets(
              node ? runtime.fields(node) : [],
              context.value,
              message(cause),
            ),
          );
        }
      },
    },
  };
}
