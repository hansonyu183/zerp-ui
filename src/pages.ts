import { h, toValue, type MaybeRefOrGetter, type VNodeChild } from "vue";
import DetailsPageView from "./DetailsPage.vue";
import type { DetailGroup } from "./details";
import type { EditWriteState, EditProtection } from "./edit-guard";

export type AppPageHandle = { requestLeave(): Promise<boolean> };
export type PageKind =
  | "crud"
  | "configuration"
  | "report"
  | "document"
  | "voucher"
  | "workflow"
  | "details"
  | "profile"
  | "change-password";
export type PageSource<T> = MaybeRefOrGetter<T>;
type ContentOnly = {
  component?: never;
  render?: never;
  template?: never;
  slots?: never;
  layout?: never;
  style?: never;
  class?: never;
  css?: never;
};
/** Package-private capability. Consumers can obtain it only from a finite page factory. */
export const snapshotPage = Symbol("zerp.page");
export type PageContext = {
  scope: string;
  active: boolean;
  discardVersion: number;
  protection: (value: EditProtection) => void;
  requestLeave: () => Promise<boolean>;
};
export interface PageDefinition {
  readonly kind: PageKind;
  readonly title: string;
  readonly [snapshotPage]: () => PageSnapshot;
}
export type PageAdmission = {
  definition?: object;
  record?: unknown;
  security?: unknown;
};
export type PageSnapshot = PageAdmission & {
  title: string;
  render: (context: PageContext) => VNodeChild;
};
function page<T extends { title: string }>(
  kind: PageKind,
  source: PageSource<T>,
  render: (value: T, context: PageContext) => VNodeChild,
  admission: (value: T) => PageAdmission = () => ({}),
): PageDefinition {
  return Object.freeze({
    kind,
    get title() {
      return toValue(source).title;
    },
    [snapshotPage]: () => {
      const value = toValue(source);
      return {
        ...admission(value),
        title: value.title,
        render: (context: PageContext) => render(value, context),
      };
    },
  });
}
export type DetailsPage<
  T extends object,
  I,
  H extends object = object,
  R extends object = object,
  C extends object = object,
> = ContentOnly & {
  title: string;
  value: T;
  groups: readonly DetailGroup<T, I>[];
  instance: string | number;
  onRelated?: (intent: I) => void;
  writeState?: EditWriteState;
  onProtection?: (value: EditProtection) => void;
  editor?: {
    definition: VoucherEditorDefinition<H, R, C>;
    value: VoucherEditorValue<H, R>;
    onChange?: (value: VoucherEditorValue<H, R>) => void;
  };
};
export function defineDetailsPage<
  T extends object,
  I = never,
  H extends object = object,
  R extends object = object,
  C extends object = object,
>(source: PageSource<DetailsPage<T, I, H, R, C>>): PageDefinition {
  return page(
    "details",
    source,
    (value, context) =>
      h(DetailsPageView<T, I, H, R, C>, {
        options: value,
        scope: context.scope,
        discardVersion: context.discardVersion,
        onProtection: protect(context, value),
      }),
    (value) => ({ record: value.instance }),
  );
}

import CrudView from "./CrudView.vue";
import ConfigurationView from "./ConfigurationView.vue";
import ReportView from "./ReportView.vue";
import DocumentView from "./DocumentView.vue";
import VoucherSubmission from "./VoucherSubmission.vue";
import WorkflowView from "./WorkflowView.vue";
import type { CrudDefinition, CrudAction, ListAction } from "./contracts";
import type {
  ConfigurationDefinition,
  ConfigurationDraft,
} from "./configuration";
import type { ReportDefinition, ReportSnapshot, ReportDrill } from "./report";
import type { DocumentDefinition } from "./document";
import type { VoucherDefinition } from "./voucher";
import type { WorkflowDefinition, WorkflowAction } from "./workflow";
import type { DomainBlock } from "./domain-blocks";

type ReadPermissions = { read: boolean; write: boolean; reconcile?: boolean };
type ProtectedPage = ContentOnly & {
  onProtection?: (value: EditProtection) => void;
};
function protect(context: PageContext, external: ProtectedPage) {
  return (state: EditProtection) => {
    context.protection(state);
    external.onProtection?.(state);
  };
}
export type CrudPage<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
> = ProtectedPage & {
  definition: CrudDefinition<D, F, R, I, E>;
  permissions: {
    query: boolean;
    create: boolean;
    write: boolean;
    reconcile?: boolean;
  };
  blocks?: readonly DomainBlock<D>[];
  initialRow?: R;
  readOnly?: boolean;
  selection?: {
    rowKey: (row: R) => string | number;
    selectedKeys: readonly (string | number)[];
    onChange: (keys: (string | number)[]) => void;
  };
  listActions?: (row: R) => readonly Exclude<ListAction, CrudAction>[];
  onListAction?: (action: Exclude<ListAction, CrudAction>, row: R) => void;
  onQueried?: (filters: F) => void;
};
export function defineCrudPage<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
>(source: PageSource<CrudPage<D, F, R, I, E>>): PageDefinition {
  return page(
    "crud",
    () => {
      const value = toValue(source);
      return { ...value, title: value.definition.title };
    },
    (value, context) =>
      h(CrudView<D, F, R, I, E>, {
        definition: value.definition,
        permissions: value.permissions,
        blocks: value.blocks,
        scope: context.scope,
        initialRow: value.initialRow,
        readOnly: value.readOnly,
        beforeClose: context.requestLeave,
        discardVersion: context.discardVersion,
        onProtection: protect(context, value),
        onQueried: value.onQueried,
        rowKey: value.selection?.rowKey,
        selectedKeys: value.selection?.selectedKeys,
        "onUpdate:selectedKeys": value.selection?.onChange,
        listActions: value.listActions,
        onListAction: value.onListAction,
      }),
    (value) => ({
      definition: value.definition,
      record:
        value.initialRow === undefined
          ? undefined
          : value.definition.identity(value.initialRow),
    }),
  );
}
export type ConfigurationPage<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
> = ProtectedPage & {
  definition: ConfigurationDefinition<D, F, R, I, E>;
  permissions: ReadPermissions;
  blocks?: readonly DomainBlock<D>[];
  initialRow?: R;
  retainEditor?: boolean;
  onQueried?: (filters: F) => void;
  onDraft?: (value: ConfigurationDraft<D, I> | null) => void;
};
export function defineConfigurationPage<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
>(source: PageSource<ConfigurationPage<D, F, R, I, E>>): PageDefinition {
  return page(
    "configuration",
    () => {
      const value = toValue(source);
      return { ...value, title: value.definition.title };
    },
    (value, context) =>
      h(ConfigurationView<D, F, R, I, E>, {
        definition: value.definition,
        permissions: value.permissions,
        blocks: value.blocks,
        scope: context.scope,
        initialRow: value.initialRow,
        retainEditor: value.retainEditor,
        beforeClose: context.requestLeave,
        discardVersion: context.discardVersion,
        onProtection: protect(context, value),
        onQueried: value.onQueried,
        onDraft: value.onDraft,
      }),
    (value) => ({
      definition: value.definition,
      record:
        value.initialRow === undefined
          ? undefined
          : value.definition.identity(value.initialRow),
    }),
  );
}
export type ReportPageDefinition<
  P extends object,
  R extends object,
  I = string,
  K extends string | number = string | number,
  T = never,
> = ContentOnly & {
  definition: ReportDefinition<P, R, I, K, T>;
  permissions: { query: boolean; export: boolean };
  pageSize?: number;
  restore?: ReportSnapshot<P, R, I, K, T>;
  onSnapshot?: (value: ReportSnapshot<P, R, I, K, T>) => void;
  onParameters?: (value: P) => void;
  onAdopted?: (value: { parameters: P; resultId: I | null } | null) => void;
  onDrill?: (value: ReportDrill<I, K, T>) => void;
};
export function defineReportPage<
  P extends object,
  R extends object,
  I = string,
  K extends string | number = string | number,
  T = never,
>(source: PageSource<ReportPageDefinition<P, R, I, K, T>>): PageDefinition {
  return page(
    "report",
    () => {
      const value = toValue(source);
      return { ...value, title: value.definition.title };
    },
    (value, context) =>
      h(ReportView<P, R, I, K, T>, {
        definition: value.definition,
        permissions: value.permissions,
        scope: context.scope,
        active: context.active,
        pageSize: value.pageSize,
        restore: value.restore,
        onSnapshot: value.onSnapshot,
        onParameters: value.onParameters,
        onAdopted: value.onAdopted,
        onDrill: value.onDrill,
      }),
    (value) => ({ definition: value.definition }),
  );
}
export type DocumentPage<
  D extends object,
  I,
  S,
  O,
  H,
  A extends object,
  E = never,
> = ProtectedPage & {
  definition: DocumentDefinition<D, I, S, O, H, A, E>;
  permissions: ReadPermissions;
  blocks?: readonly DomainBlock<D>[];
};
export function defineDocumentPage<
  D extends object,
  I,
  S,
  O,
  H,
  A extends object,
  E = never,
>(source: PageSource<DocumentPage<D, I, S, O, H, A, E>>): PageDefinition {
  return page(
    "document",
    () => {
      const value = toValue(source);
      return { ...value, title: value.definition.title };
    },
    (value, context) =>
      h(DocumentView<D, I, S, O, H, A, E>, {
        definition: value.definition,
        permissions: value.permissions,
        blocks: value.blocks,
        scope: context.scope,
        beforeClose: context.requestLeave,
        discardVersion: context.discardVersion,
        onProtection: protect(context, value),
      }),
    (value) => ({ definition: value.definition }),
  );
}
export type VoucherPage<
  D extends object,
  I,
  R,
  U,
  S,
  O,
  H,
  A extends object,
  E = never,
  SD extends object = object,
  SF extends object = object,
  SR extends object = object,
  SI = never,
  SE = never,
> = ProtectedPage & {
  definition: VoucherDefinition<D, I, R, U, S, O, H, A, E>;
  permissions: ReadPermissions;
  blocks?: readonly DomainBlock<D>[];
  script?: {
    definition: ConfigurationDefinition<SD, SF, SR, SI, SE>;
    permissions: ReadPermissions;
  };
};
export function defineVoucherPage<
  D extends object,
  I,
  R,
  U,
  S,
  O,
  H,
  A extends object,
  E = never,
  SD extends object = object,
  SF extends object = object,
  SR extends object = object,
  SI = never,
  SE = never,
>(
  source: PageSource<
    VoucherPage<D, I, R, U, S, O, H, A, E, SD, SF, SR, SI, SE>
  >,
): PageDefinition {
  return page(
    "voucher",
    () => {
      const value = toValue(source);
      return { ...value, title: value.definition.title };
    },
    (value, context) =>
      h(VoucherSubmission<D, I, R, U, S, O, H, A, E, SD, SF, SR, SI, SE>, {
        definition: value.definition,
        permissions: value.permissions,
        blocks: value.blocks,
        scope: context.scope,
        script: value.script,
        beforeClose: context.requestLeave,
        discardVersion: context.discardVersion,
        onProtection: protect(context, value),
      }),
    (value) => ({ definition: value.definition }),
  );
}
export type WorkflowPage<
  I,
  N,
  R,
  T,
  D,
  A extends object,
  E = never,
> = ProtectedPage & {
  definition: WorkflowDefinition<I, N, R, T, D, A, E>;
  permissions: {
    read: boolean;
    audit: boolean;
    reconcile?: boolean;
    actions: readonly WorkflowAction[];
    targets: readonly string[];
  };
  onOpenVoucher?: (value: D) => void;
};
export function defineWorkflowPage<I, N, R, T, D, A extends object, E = never>(
  source: PageSource<WorkflowPage<I, N, R, T, D, A, E>>,
): PageDefinition {
  return page(
    "workflow",
    () => {
      const value = toValue(source);
      return { ...value, title: value.definition.title };
    },
    (value, context) =>
      h(WorkflowView<I, N, R, T, D, A, E>, {
        definition: value.definition,
        permissions: value.permissions,
        scope: context.scope,
        discardVersion: context.discardVersion,
        onProtection: protect(context, value),
        onOpenVoucher: value.onOpenVoucher,
      }),
    (value) => ({ definition: value.definition }),
  );
}

import OperationPage from "./OperationPage.vue";
import type {
  VoucherEditorDefinition,
  VoucherEditorValue,
} from "./voucher-editor";
import type {
  VoucherOperationModel,
  VoucherOperationDefinition,
  VoucherOperationIntent,
  VoucherOperationRequest,
  VoucherOperationSettlement,
} from "./voucher-operation";
export type VoucherOperationPage<
  M extends VoucherOperationModel,
  I,
  B,
  H extends object = object,
  R extends object = object,
  C extends object = object,
> = ProtectedPage & {
  title: string;
  definition: VoucherOperationDefinition<M, I, B>;
  intent: VoucherOperationIntent<M, I>;
  eligible: boolean;
  recoveryAllowed: boolean;
  editor?: {
    definition: VoucherEditorDefinition<H, R, C>;
    value: VoucherEditorValue<H, R>;
    toIntent: (
      value: VoucherEditorValue<H, R>,
      base: VoucherOperationIntent<M, I>,
    ) => VoucherOperationIntent<M, I>;
    restore: (
      request: VoucherOperationRequest<M, I, B>,
    ) => VoucherEditorValue<H, R> | null;
    adopt: (settlement: VoucherOperationSettlement<M, I, B>) => {
      value: VoucherEditorValue<H, R>;
      intent: VoucherOperationIntent<M, I>;
    } | null;
  };
  onSettled?: (value: VoucherOperationSettlement<M, I, B>) => void;
};
export function defineVoucherOperationPage<
  M extends VoucherOperationModel,
  I,
  B,
  H extends object = object,
  R extends object = object,
  C extends object = object,
>(source: PageSource<VoucherOperationPage<M, I, B, H, R, C>>): PageDefinition {
  return page(
    "voucher",
    source,
    (value, context) =>
      h(OperationPage<M, I, B, H, R, C>, {
        options: value,
        scope: context.scope,
        discardVersion: context.discardVersion,
        onProtection: protect(context, value),
      }),
    (value) => ({
      definition: value.definition,
      record: [
        value.intent.owner.resource,
        value.intent.identity,
        value.intent.action,
      ],
      security: [value.intent.owner.scope, value.intent.owner.operator],
    }),
  );
}

import ControlledAccountForm from "./ControlledAccountForm.vue";
import type { Fields } from "./contracts";
export type AccountPage<D extends object> = ProtectedPage & {
  kind: "profile" | "change-password";
  title: string;
  instance?: string | number;
  values: D;
  fields: Fields<D>;
  busy?: boolean;
  error?: string;
  notice?: string;
  submitLabel?: string;
  cancelLabel?: string;
  validate?: (values: D) => string | undefined;
  submit: (values: D) => void;
  onCancel?: () => void;
  onChange?: (values: D) => void;
};
export function defineAccountPage<D extends object>(
  source: PageSource<AccountPage<D>>,
): PageDefinition {
  const kind = toValue(source).kind;
  return page(
    kind,
    source,
    (value, context) =>
      h(ControlledAccountForm<D>, {
        scope: context.scope,
        kind: value.kind,
        instance: value.instance,
        values: value.values,
        fields: value.fields,
        busy: value.busy,
        error: value.error,
        notice: value.notice,
        submitLabel: value.submitLabel,
        cancelLabel: value.cancelLabel,
        validate: value.validate,
        discardVersion: context.discardVersion,
        onSubmit: value.submit,
        onCancel: value.onCancel,
        "onUpdate:values": value.onChange,
        onProtection: protect(context, value),
      }),
    (value) => ({ record: value.kind }),
  );
}
