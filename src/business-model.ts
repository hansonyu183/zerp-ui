import { nodeMetadata } from "./model-node";

/** Operations read and update their own model; transport and outcomes belong to the consumer. */
type Operation = {
  disabledReason?: string;
  run(): Promise<void>;
};

type ObjectAction = "get" | "update" | "delete" | "reconcile";
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
        kind: "text" | "decimal";
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
    operations: Partial<Record<ObjectAction, Operation>>;
  };
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

type Node = Field | ObjectNode | CollectionNode;
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
 * This first type slice covers ordinary objects and collections. The existing
 * BusinessApplication runtime has not yet migrated to this contract.
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
