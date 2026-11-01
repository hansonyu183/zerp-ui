export { defineCrud } from "./contracts";
export type {
  Page,
  ReferenceValue,
  ReferenceAdapter,
  Fields,
  Column,
  CrudAction,
  ListAction,
  Attempt,
  WriteResult,
  ReconcileResult,
  CrudAdapter,
  CrudDefinition,
} from "./contracts";
import "./style.css";
import "./shell-layout.css";
export { defineConfiguration } from "./configuration";
export type {
  ConfigurationDefinition,
  ConfigurationAdapter,
  ConfigurationAttempt,
  ConfigurationDraft,
  ConfigurationWriteResult,
  ConfigurationReconcileResult,
} from "./configuration";

export { defineReport, ReportUnavailable } from "./report";
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
} from "./report";

export { defineDocument } from "./document";
export type {
  DocumentAction,
  DocumentSnapshot,
  DocumentArchive,
  DocumentAttempt,
  StageAttempt,
  DocumentReconciliation,
  DocumentAdapter,
  DocumentDefinition,
} from "./document";

export type {
  VoucherEditorValue,
  VoucherEditorDefinition,
  VoucherEditorColumn,
  VoucherEditorChildColumn,
} from "./voucher-editor";
export { defineVoucher } from "./voucher";
export type {
  VoucherIdentity,
  VoucherSnapshot,
  VoucherArchive,
  VoucherAttempt,
  VoucherStageAttempt,
  VoucherReconciliation,
  VoucherAdapter,
  VoucherDefinition,
} from "./voucher";

export { defineWorkflow } from "./workflow";
export type {
  WorkflowAction,
  WorkflowNode,
  WorkflowInstance,
  WorkflowAttempt,
  WorkflowAdapter,
  WorkflowDefinition,
} from "./workflow";

export { default as AppPage } from "./AppPage.vue";
export { default as AuthPage } from "./AuthPage.vue";
export type {
  AuthMode,
  AuthValues,
  AuthCapabilities,
  AuthSubmit,
} from "./auth";
export { createShellThemes, defaultThemeChoice } from "./shell";
export type {
  ThemeChoice,
  BrandColors,
  Brand,
  LoadState,
  AccountIntent,
  ShellAccount,
  NavigationIcon,
  NavigationGroup,
} from "./shell";

export { defineOperation, operationLabels } from "./operation";
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
} from "./operation";

export type { DetailFields, DetailGroup } from "./details";
export type { EditWriteState, EditProtection } from "./edit-guard";

export { validateFields } from "./validation";
export type {
  FieldValidationIssue,
  FieldValidationResult,
  FormValidationState,
} from "./validation";

export { defineDetailsPage } from "./pages";
export type {
  PageDefinition,
  PageKind,
  PageSource,
  AppPageHandle,
  DetailsPage,
} from "./pages";
export { domainBlocks } from "./domain-blocks";
export type { DomainBlock } from "./domain-blocks";

export {
  defineCrudPage,
  defineConfigurationPage,
  defineReportPage,
  defineDocumentPage,
  defineVoucherPage,
  defineWorkflowPage,
} from "./pages";
export type {
  CrudPage,
  ConfigurationPage,
  ReportPageDefinition,
  DocumentPage,
  VoucherPage,
  WorkflowPage,
} from "./pages";
export { defineOperationPage } from "./pages";
export type { OperationPageDefinition } from "./pages";
export { defineAccountPage } from "./pages";
export type { AccountPage } from "./pages";

export { defineTaskPage } from "./pages";
export type { TaskPage, TaskAction } from "./tasks";
export type {
  DraftCollaboration,
  Interaction,
  InteractionAnswers,
} from "./collaboration";
export type {
  WriteOwner,
  WriteJournal,
  WritePersistence,
} from "./write-recovery";
export type { PrintItem, PrintDocument } from "./printing";
export { defineBatchPage } from "./pages";
export type {
  BatchPage,
  BatchEntry,
  BatchJournal,
  BatchPersistence,
} from "./batch";
export type { OperationActionOf } from "./operation";
