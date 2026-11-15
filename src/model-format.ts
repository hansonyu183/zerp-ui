import type { FieldNode, DecimalFormat } from "./business-model";

function decimal(value: string, format: DecimalFormat = {}): string {
  if (value === "") return "";
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(value);
  if (!match) throw Error("十进制值无效");
  const min = format.minimumFractionDigits ?? 0;
  const max = format.maximumFractionDigits;
  if (
    !Number.isInteger(min) ||
    min < 0 ||
    min > 100 ||
    (max !== undefined && (!Number.isInteger(max) || max < min || max > 100))
  )
    throw Error("小数位格式无效");
  let whole = BigInt(match[2]!);
  let fraction = match[3] ?? "";
  if (max !== undefined && fraction.length > max) {
    const scale = 10n ** BigInt(max);
    const rounded =
      whole * scale +
      BigInt(fraction.slice(0, max) || "0") +
      (fraction[max]! >= "5" ? 1n : 0n);
    whole = rounded / scale;
    fraction = max ? (rounded % scale).toString().padStart(max, "0") : "";
  }
  fraction = fraction.padEnd(min, "0");
  const language = new Intl.NumberFormat(format.locale, {
    useGrouping: format.useGrouping ?? false,
  });
  const digits = new Intl.NumberFormat(format.locale, { useGrouping: false });
  const decimalMark =
    new Intl.NumberFormat(format.locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  const minus =
    language.formatToParts(-1).find((part) => part.type === "minusSign")
      ?.value ?? "-";
  return `${match[1] === "-" ? minus : ""}${language.format(whole)}${fraction ? decimalMark + [...fraction].map((digit) => digits.format(Number(digit))).join("") : ""}${format.unit ? ` ${format.unit}` : ""}`;
}

/** Display only. Numeric business values never pass through Number or a locale parser. */
export function formatField(field: FieldNode): string {
  try {
    if (field.kind === "decimal") return decimal(field.value, field.format);
    if (field.kind === "date" || field.kind === "datetime") {
      if (!field.value) return "";
      const isDate = field.kind === "date";
      if (isDate && !/^\d{4}-\d{2}-\d{2}$/.test(field.value))
        throw Error("日期值无效");
      if (
        !isDate &&
        !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(field.value)
      )
        throw Error("日期时间须包含时区");
      const date = new Date(
        isDate ? `${field.value}T00:00:00.000Z` : field.value,
      );
      if (
        !Number.isFinite(date.getTime()) ||
        (isDate && date.toISOString().slice(0, 10) !== field.value)
      )
        throw Error("日期值无效");
      const defaults: Intl.DateTimeFormatOptions = isDate
        ? { year: "numeric", month: "numeric", day: "numeric" }
        : {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
          };
      const { locale, ...options } = field.format ?? {};
      return new Intl.DateTimeFormat(locale, {
        ...(field.format ? options : defaults),
        ...(isDate ? { timeZone: "UTC" } : {}),
      }).format(date);
    }
    if (field.kind === "secret" || field.kind === "password") return "••••••";
    if (field.kind === "attachments")
      return field.value.map((file) => file.name).join("、");
    if (field.kind === "reference" || field.kind === "treeReference")
      return Array.isArray(field.value)
        ? field.value.map((value) => value.label).join("、")
        : (field.value?.label ?? "");
    if (field.kind === "boolean") return field.value ? "是" : "否";
    return field.value == null ? "" : String(field.value);
  } catch (cause) {
    throw Error(
      `${field.label ?? field.key}：${cause instanceof Error ? cause.message : "显示格式无效"}。`,
    );
  }
}
