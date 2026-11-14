import { nodeMetadata } from "./model-node";
import type { PrintDocument } from "./printing";

/** Operations read and update their own model; transport and outcomes belong to the consumer. */
type Operation = {
  disabledReason?: string;
  run(): Promise<void>;
};

type BaseObjectAction = "get" | "update" | "delete" | "reconcile";
type FamilyActions = {
  authentication: "signIn" | "recover";
  account: "changePassword" | "signOut";
  document: "submit" | "approve" | "enable" | "disable";
  voucher:
    | "submit"
    | "approve"
    | "withdraw"
    | "reverse"
    | "calculate"
    | "stageAttachments";
  workflow: "start" | "advance" | "approveChild" | "cancel";
  batch: "executeBatch" | "cancel";
  report: "calculate" | "export";
  output: "preview" | "print" | "confirmPrinted" | "confirmNotPrinted";
};
type ObjectAction = BaseObjectAction | FamilyActions[keyof FamilyActions];
type ObjectOperations =
  | { family?: never; operations: Partial<Record<BaseObjectAction, Operation>> }
  | {
      [F in keyof FamilyActions]: {
        family: F;
        operations: Partial<
          Record<BaseObjectAction | FamilyActions[F], Operation>
        >;
      };
    }[keyof FamilyActions];
type CollectionAction = "query" | "create" | "export";

type Owner = {
  ledger: string;
  operator: string;
  generation: string;
};

type Field =
  | {
      value: string;
      [nodeMetadata]: {
        kind: "text" | "decimal" | "password" | "date";
        name: string;
        required?: boolean;
        readOnly?: boolean;
      };
    }
  | {
      value: boolean;
      [nodeMetadata]: {
        kind: "boolean";
        name: string;
        readOnly?: boolean;
      };
    }
  | {
      value:
        | { id: string; label: string; selectable?: boolean }
        | { id: string; label: string; selectable?: boolean }[]
        | null;
      [nodeMetadata]: {
        kind: "reference";
        name: string;
        readOnly?: boolean;
        multiple?: boolean;
        /** Entire directory, populated by load; filtering and paging stay local. */
        options: readonly { id: string; label: string; selectable?: boolean }[];
        dependencies?: readonly (string | number | boolean | null)[];
        load?: Operation;
      };
    }
  | {
      value: File[];
      [nodeMetadata]: {
        kind: "attachments";
        name: string;
        readOnly?: boolean;
        multiple?: boolean;
      };
    }
  | {
      value: PrintDocument | null;
      [nodeMetadata]: { kind: "output"; name: string; readOnly?: boolean };
    };

interface ObjectNode {
  [member: string]: Node;
  [nodeMetadata]: {
    kind: "object";
    name: string;
    identity?: string;
    /** Ordered content projection; omitted means member declaration order. */
    form?: readonly string[];
    readOnly?: boolean;
  } & ObjectOperations;
}

type CollectionNode = {
  items: ObjectNode[];
  selected: ObjectNode | null;
  /** The unsaved new record itself, not a copy of an existing record's values. */
  draft: ObjectNode | null;
  query: ObjectNode;
  page: number;
  pageSize: number;
  total: number;
  [nodeMetadata]: {
    kind: "collection";
    name: string;
    /** Record structure and available operations, also readable when items is empty. */
    element: ObjectNode;
    list: readonly string[];
    operations: Partial<Record<CollectionAction, Operation>>;
  };
};

type ArrayNode = {
  items: ObjectNode[];
  [nodeMetadata]: {
    kind: "array";
    name: string;
    readOnly?: boolean;
    element: ObjectNode;
    /** Local value edits; they do not establish a separate persistence boundary. */
    operations: Partial<Record<"create", Operation>>;
  };
};
type Node = Field | ObjectNode | CollectionNode | ArrayNode;
type Target = ObjectNode | CollectionNode;

type Permission = {
  node: Node;
  read: boolean;
  write?: boolean;
  /** Collection grants may also authorize their records' object operations. */
  operations?: Partial<Record<ObjectAction | CollectionAction, boolean>>;
};

/**
 * Directly defined target contract for BusinessApplication, independent of examples.
 *
 * Business member names are open; node kinds and operation names are closed.
 * Inputs live directly in field values. No editor baseline, frozen request,
 * persistence port, component, template or parallel page definition is required.
 *
 * All business families share direct values and no-argument operations.
 * Family discriminants restrict operations without selecting consumer layouts.
 * @see https://github.com/hansonyu183/zerp-ui/issues/152
 */
export interface BusinessModel {
  [businessMember: string]: Node;
  [nodeMetadata]: {
    kind: "application";
    name: string;
    brand: {
      productName: string;
      companyName: string;
    };
    owner: Owner | null;
    authentication?: ObjectNode;
    account?: {
      name: string;
      profile?: ObjectNode;
      password?: ObjectNode;
      signOut?: Operation;
    };
    session?: {
      state: "anonymous" | "ready" | "recovering" | "password-required";
      message?: string;
    };
    /** null means authorization is not ready; it never grants workspace access. */
    userPermissions:
      | ({ owner: Owner } & (
          | { administrator: true; grants?: never }
          | { administrator: false; grants: Permission[] }
        ))
      | null;
    navigation: {
      current: Target | null;
      href(node: Target): string;
      visit(node: Target): void;
    };
    /** Only these targets participate in global navigation. */
    navigationProjection: {
      key: string;
      name: string;
      items: { node: Target }[];
    }[];
    messages: {
      id: string;
      level: "info" | "error";
      text: string;
    }[];
  };
}
