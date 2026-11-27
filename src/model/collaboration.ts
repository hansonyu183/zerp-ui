export type Interaction<T = never, A = never, D = never> =
  | {
      kind: "message";
      id: string;
      message: string;
      level?: "error" | "warning" | "status";
    }
  | { kind: "confirm"; id: string; label: string; required?: boolean }
  | {
      kind: "input";
      id: string;
      label: string;
      required?: boolean;
      options?: readonly { value: string; label: string }[];
    }
  | {
      kind: "menu" | "tree";
      id: string;
      label: string;
      items: readonly {
        key: string;
        label: string;
        target: T | A;
        disabled?: boolean;
        children?: readonly {
          key: string;
          label: string;
          target: T | A;
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
  | {
      kind: "related";
      id: string;
      label: string;
      target: T;
      disabled?: boolean;
    }
  | {
      kind: "download";
      id: string;
      label: string;
      target: T | D;
      disabled?: boolean;
    };
export type InteractionAnswers = Readonly<Record<string, string | boolean>>;
