// Private regression harness for the retained internal engines. Never packaged.
export { defineCrud } from "../../src/contracts";
export type {
  Page,
  ReferenceValue,
  ReferenceAdapter,
  Fields,
  FieldGroup,
  Column,
  CrudAction,
  ListAction,
  Attempt,
  WriteResult,
  ReconcileResult,
  CrudAdapter,
  CrudDefinition,
} from "../../src/contracts";
import "../../src/style.css";
import "../../src/shell-layout.css";
export { defineConfiguration } from "../../src/configuration";
export type {
  ConfigurationDefinition,
  ConfigurationAdapter,
  ConfigurationAttempt,
  ConfigurationDraft,
  ConfigurationWriteResult,
  ConfigurationReconcileResult,
} from "../../src/configuration";

export { defineReport, ReportUnavailable } from "../../src/report";
export type {
  ReportAppearance,
  ReportPresentation,
  ReportPage,
  ReportSnapshot,
  FixedReportAdapter,
  ReportCell,
  ReportDrill,
  ReportSummary,
  ReportValidity,
  ReportCancellation,
  ReportResultRequest,
  ReportParameters,
  ReportColumn,
  ReportQuery,
  ReportExport,
  ReportAdapter,
  ReportDefinition,
} from "../../src/report";

export { defineDocument } from "../../src/document";
export type {
  DocumentAction,
  DocumentSnapshot,
  DocumentArchive,
  DocumentAttempt,
  StageAttempt,
  DocumentReconciliation,
  DocumentAdapter,
  DocumentDefinition,
} from "../../src/document";

export type {
  VoucherEditorValue,
  VoucherEditorChange,
  VoucherEditorRowDraft,
  VoucherEditorDefinition,
  VoucherEditorColumn,
  VoucherEditorChildColumn,
} from "../../src/voucher-editor";
export { defineVoucher } from "../../src/voucher";
export type {
  VoucherIdentity,
  VoucherSnapshot,
  VoucherArchive,
  VoucherAttempt,
  VoucherStageAttempt,
  VoucherReconciliation,
  VoucherAdapter,
  VoucherDefinition,
} from "../../src/voucher";

export { defineWorkflow } from "../../src/workflow";
export type {
  WorkflowAction,
  WorkflowNode,
  WorkflowInstance,
  WorkflowAttempt,
  WorkflowAdapter,
  WorkflowDefinition,
} from "../../src/workflow";

export { default as AppPage } from "../../src/AppPage.vue";
export { default as AuthPage } from "../../src/AuthPage.vue";
export type {
  AuthMode,
  AuthValues,
  AuthCapabilities,
  AuthSubmit,
} from "../../src/auth";
export { createShellThemes, defaultThemeChoice } from "../../src/shell";
export type {
  ThemeChoice,
  BrandColors,
  Brand,
  LoadState,
  AccountIntent,
  ShellAccount,
  NavigationIcon,
  NavigationGroup,
} from "../../src/shell";

export { defineOperation, operationLabels } from "../../src/operation";
export type {
  OperationAssociation,
  OperationAction,
  OperationOwner,
  OperationPreview,
  OperationModel,
  OperationIntent,
  OperationRequest,
  OperationReceipt,
  OperationOutcome,
  OperationSettlement,
  OperationJournal,
  OperationPersistence,
  OperationDefinition,
} from "../../src/operation";

export type { DetailFields, DetailGroup } from "../../src/details";
export type { EditWriteState, EditProtection } from "../../src/edit-guard";

export { validateFields } from "../../src/validation";
export type {
  FieldValidationIssue,
  FieldValidationResult,
  FormValidationState,
} from "../../src/validation";

export { defineDetailsPage } from "../../src/pages";
export type {
  PageDefinition,
  PageKind,
  PageSource,
  AppPageHandle,
  DetailsPage,
} from "../../src/pages";
export { domainBlocks } from "../../src/domain-blocks";
export type { DomainBlock } from "../../src/domain-blocks";

export {
  defineCrudPage,
  defineConfigurationPage,
  defineReportPage,
  defineDocumentPage,
  defineVoucherPage,
  defineWorkflowPage,
} from "../../src/pages";
export type {
  CrudPage,
  ConfigurationPage,
  ReportPageDefinition,
  DocumentPage,
  VoucherPage,
  WorkflowPage,
} from "../../src/pages";
export { defineOperationPage } from "../../src/pages";
export type { OperationPageDefinition } from "../../src/pages";
export { defineAccountPage } from "../../src/pages";
export type { AccountPage } from "../../src/pages";

export { defineTaskPage } from "../../src/pages";
export type { TaskPage, TaskAction } from "../../src/tasks";
export type {
  DraftCollaboration,
  Interaction,
  InteractionAnswers,
  ReportInteractions,
} from "../../src/collaboration";
export type {
  WriteOwner,
  WriteJournal,
  WritePersistence,
} from "../../src/write-recovery";
export type { PrintItem, PrintDocument } from "../../src/printing";
export { defineBatchPage } from "../../src/pages";
export type {
  BatchPage,
  BatchEntry,
  BatchJournal,
  BatchPersistence,
} from "../../src/batch";
export type { OperationActionOf } from "../../src/operation";

export {
  defineWorkbenchPage,
  defineWorkbenchPreferencesPage,
} from "../../src/pages";
export type {
  WorkbenchRequest,
  WorkbenchLink,
  WorkbenchSection,
  WorkbenchSnapshot,
  WorkbenchAdapter,
  WorkbenchPage,
  WorkbenchPreference,
  WorkbenchPreferencesAdapter,
  WorkbenchPreferencesPage,
} from "../../src/workbench";

export type { PageNavigationGroup, RecordLink } from "../../src/shell";

export { defineBusinessPage, defineModulePage } from "../../src/business";
export type { BusinessObject } from "../../src/business-type";
export type {
  BusinessDefinition,
  BusinessPage,
  ModuleEntry,
  ModuleDefinition,
} from "../../src/business";

export { applicationNavigation } from "../../src/application";
export type { ApplicationObject } from "../../src/business-type";

export {
  projectBusinessFields,
  projectBusinessColumns,
  defineBusinessAccountPage,
} from "../../src/business";
export {
  defineBusinessWorkbenchPage,
  defineBusinessWorkbenchPreferencesPage,
} from "../../src/workbench";
export {
  projectReportParameters,
  projectReportColumns,
  projectTaskFields,
} from "../../src/business-report";

export { projectBusinessVoucherEditor } from "../../src/business";
export type { BusinessVoucherInteraction } from "../../src/business";

export { projectBusinessBatchEntries } from "../../src/business";

export { default as BusinessApplication } from "../../src/BusinessApplication.vue";
