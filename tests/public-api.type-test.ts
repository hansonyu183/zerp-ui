// This file is also compiled against the independently installed tarball.
// @ts-expect-error Internal business components are not public entry points.
import { CrudView } from "@zerp/ui";
// @ts-expect-error Internal business components are not public entry points.
import { ConfigurationView } from "@zerp/ui";
// @ts-expect-error Internal business components are not public entry points.
import { ReportView } from "@zerp/ui";
// @ts-expect-error Internal business components are not public entry points.
import { DocumentView } from "@zerp/ui";
// @ts-expect-error Internal business components are not public entry points.
import { VoucherView } from "@zerp/ui";
// @ts-expect-error Internal business components are not public entry points.
import { WorkflowView } from "@zerp/ui";
// @ts-expect-error Forms are owned by complete pages.
import { DynamicForm } from "@zerp/ui";
// @ts-expect-error References are owned by complete pages.
import { ReferencePicker } from "@zerp/ui";
// @ts-expect-error Lists are owned by complete pages.
import { DataList } from "@zerp/ui";
// @ts-expect-error Details are owned by complete pages.
import { RecordDetails } from "@zerp/ui";
// @ts-expect-error Leave confirmation is owned by complete pages.
import { EditGuard } from "@zerp/ui";
// @ts-expect-error Voucher editing is owned by complete pages.
import { VoucherEditor } from "@zerp/ui";
// @ts-expect-error Consumer component blocks have been removed.
import { configurationBlock } from "@zerp/ui";
// @ts-expect-error Runtime VM handles cannot be imported.
import type { CrudViewHandle } from "@zerp/ui";
// @ts-expect-error Runtime VM handles cannot be imported.
import type { ConfigurationViewHandle } from "@zerp/ui";
// @ts-expect-error Runtime VM handles cannot be imported.
import type { VoucherOperationHandle } from "@zerp/ui";
// @ts-expect-error Runtime VM handles cannot be imported.
import type { EditGuardHandle } from "@zerp/ui";
// @ts-expect-error Private source subpaths are not package exports.
import type {} from "@zerp/ui/src/pages";
// @ts-expect-error Private generated declarations are not package exports.
import type {} from "@zerp/ui/dist/pages";
void [
  CrudView,
  ConfigurationView,
  ReportView,
  DocumentView,
  VoucherView,
  WorkflowView,
  DynamicForm,
  ReferencePicker,
  DataList,
  RecordDetails,
  EditGuard,
  VoucherEditor,
  configurationBlock,
];
export type RemovedHandles = [
  CrudViewHandle,
  ConfigurationViewHandle,
  VoucherOperationHandle,
  EditGuardHandle,
];

import { AppPage, AuthPage } from "@zerp/ui";
declare const applicationSlots: InstanceType<typeof AppPage>["$slots"];
// @ts-expect-error AppPage has no consumer content slot.
applicationSlots.default();
declare const authenticationSlots: InstanceType<typeof AuthPage>["$slots"];
// @ts-expect-error AuthPage has no consumer content slot.
authenticationSlots.default();
