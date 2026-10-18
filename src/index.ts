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
export { defineReport } from "./report";
export type {
  ReportParameters,
  ReportColumn,
  ReportQuery,
  ReportExport,
  ReportAdapter,
  ReportDefinition,
} from "./report";

export { default as VersionView } from "./VersionView.vue";
export { defineVersion } from "./version";
export type {
  VersionAction,
  VersionSnapshot,
  VersionArchive,
  VersionAttempt,
  StageAttempt,
  VersionReconciliation,
  VersionAdapter,
  VersionDefinition,
} from "./version";

export { default as DocumentView } from "./DocumentView.vue";
export { defineDocument } from "./document";
export type {
  DocumentIdentity,
  DocumentSnapshot,
  DocumentArchive,
  DocumentAttempt,
  DocumentStageAttempt,
  DocumentReconciliation,
  DocumentAdapter,
  DocumentDefinition,
} from "./document";

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
