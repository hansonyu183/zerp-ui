import type {
  BusinessType,
  BusinessObject,
  BusinessValue,
} from "./business-type";
import { propertyAt } from "./business-type";
import { projectBusinessFields, projectBusinessColumns } from "./business";
import type { AnyField, Fields, ReferenceAdapter } from "./contracts";
import type { ReportParameters, ReportColumn } from "./report";

type Input<T extends BusinessObject> = BusinessType extends T
  ? object
  : BusinessObject extends T
    ? object
    : BusinessValue<T> & object;
type Row<T extends BusinessObject> = BusinessType extends T
  ? Record<string, string | null>
  : BusinessObject extends T
    ? Record<string, string | null>
    : BusinessValue<T> & object;

/** Query input remains a value object; result collections never become editors. */
export function projectReportParameters<const T extends BusinessObject>(
  model: T,
  options: {
    reference?: (field: BusinessType, path: string) => ReferenceAdapter;
    interactions?: Readonly<
      Record<
        string,
        Pick<AnyField, "when" | "mode"> & {
          enabledBy?: ReportParameters<Input<T>>[number]["enabledBy"];
        }
      >
    >;
  } = {},
): ReportParameters<Input<T>> {
  const fields = projectBusinessFields(model, options.reference).map(
    (field) => {
      if (["rows", "textarea", "secret"].includes(field.type))
        throw Error(`报表参数不支持此字段：${field.key}`);
      return {
        ...field,
        ...options.interactions?.[field.key],
      };
    },
  );
  return fields as unknown as ReportParameters<Input<T>>;
}

/** Order and empty-result columns come from the definition, never sample rows. */
export function projectReportColumns<const T extends BusinessObject>(
  model: T,
  appearance: Readonly<
    Record<string, { visible?: boolean; width?: string; role?: "action" }>
  > = {},
): ReportColumn<Row<T>>[] {
  return projectBusinessColumns<Row<T>>(model).map((column) => ({
    ...column,
    ...(propertyAt(model, String(column.key))?.kind === "date"
      ? { type: "date" }
      : {}),
    ...appearance[String(column.key)],
  })) as ReportColumn<Row<T>>[];
}

/** Use the existing TaskPage/Operation lifecycle with model-owned input fields. */
export function projectTaskFields<const T extends BusinessObject>(
  model: T,
  reference?: (field: BusinessType, path: string) => ReferenceAdapter,
): Fields<Input<T>> {
  return projectBusinessFields(model, reference) as unknown as Fields<Input<T>>;
}
