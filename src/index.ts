export { default as CrudView } from "./CrudView.vue";
export { default as DynamicForm } from "./DynamicForm.vue";
export { default as ReferencePicker } from "./ReferencePicker.vue";
export { default as DataList } from "./DataList.vue";
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
export { default as ConfigurationView } from "./ConfigurationView.vue";
export { defineConfiguration, configurationBlock } from "./configuration";
export type {
  ConfigurationDefinition,
  ConfigurationAdapter,
  ConfigurationAttempt,
  ConfigurationBlock,
  ConfigurationBlockProps,
} from "./configuration";

export { default as ReportView } from "./ReportView.vue";
export { defineReport, ReportUnavailable } from "./report";
export type {
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

export { default as DocumentView } from "./DocumentView.vue";
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

export { default as VoucherView } from "./VoucherView.vue";
export { default as VoucherEditor } from "./VoucherEditor.vue";
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

export { default as WorkflowView } from "./WorkflowView.vue";
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

export {
  defineVoucherOperation,
  voucherOperationLabels,
} from "./voucher-operation";
export type {
  VoucherOperationAction,
  VoucherOperationOwner,
  VoucherOperationPreview,
  VoucherOperationModel,
  VoucherOperationIntent,
  VoucherOperationRequest,
  VoucherOperationReceipt,
  VoucherOperationOutcome,
  VoucherOperationSettlement,
  VoucherOperationJournal,
  VoucherOperationPersistence,
  VoucherOperationDefinition,
} from "./voucher-operation";

export { default as RecordDetails } from "./RecordDetails.vue";
export type { DetailFields, DetailGroup } from "./details";
export { default as EditGuard } from "./EditGuard.vue";
export type {
  EditGuardHandle,
  EditWriteState,
  EditProtection,
} from "./edit-guard";

export { validateFields } from "./validation";
export type {
  FieldValidationIssue,
  FieldValidationResult,
  FormValidationState,
} from "./validation";
