export type Interaction<T = never> =
  | {
      kind: "message";
      id: string;
      message: string;
      level?: "error" | "warning" | "status";
    }
  | { kind: "confirm"; id: string; label: string; required?: boolean }
  | { kind: "input"; id: string; label: string; required?: boolean }
  | {
      kind: "menu" | "tree";
      id: string;
      label: string;
      items: readonly {
        key: string;
        label: string;
        target: T;
        disabled?: boolean;
        children?: readonly {
          key: string;
          label: string;
          target: T;
          disabled?: boolean;
        }[];
      }[];
    }
  | {
      kind: "grid";
      id: string;
      label: string;
      columns: readonly { key: string; label: string }[];
      rows: readonly {
        key: string;
        values: Readonly<Record<string, string | number | boolean | null>>;
      }[];
    }
  | { kind: "related" | "download"; id: string; label: string; target: T };
export type InteractionAnswers = Readonly<Record<string, string | boolean>>;
/** A read/calculation port. It must never perform the final business write. */
export type DraftCollaboration<D extends object, T = never> = {
  change(input: {
    scope: string;
    value: D;
    event: "initialize" | "change" | "answer" | "action";
    answers: InteractionAnswers;
    target?: T;
    signal: AbortSignal;
  }): Promise<{ value: D; interactions?: readonly Interaction<T>[] }>;
};
