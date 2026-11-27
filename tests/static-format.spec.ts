import { describe, expect, it } from "vitest";
import { formatField } from "../src/components/forms/model-format";
import type { FieldNode } from "../src/model";
const decimal = (
  value: string,
  format?: Extract<FieldNode, { kind: "decimal" }>["format"],
): FieldNode => ({
  key: "amount",
  label: "金额",
  kind: "decimal",
  value,
  required: false,
  readOnly: false,
  format,
});
describe("static model display formatting", () => {
  it("rounds exact decimal strings beyond the safe integer range without changing the value", () => {
    const field = decimal("9007199254740993123.995", {
      locale: "en-US",
      maximumFractionDigits: 2,
      useGrouping: true,
      unit: "元",
    });
    expect(formatField(field)).toBe("9,007,199,254,740,993,124.00 元");
    expect(field.value).toBe("9007199254740993123.995");
  });
  it("keeps civil dates independent of display timezone and datetime explicit", () => {
    expect(
      formatField({
        key: "day",
        label: "日期",
        kind: "date",
        readOnly: true,
        required: false,
        value: "2026-11-16",
        format: {
          locale: "en-CA",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      }),
    ).toBe("2026-11-16");
    expect(
      formatField({
        key: "at",
        label: "时间",
        kind: "datetime",
        readOnly: true,
        required: false,
        value: "2026-11-16T00:30:00+08:00",
        format: {
          locale: "en-GB",
          timeZone: "UTC",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
      }),
    ).toBe("16:30");
  });
  it("reports invalid formats by field without modifying the model", () => {
    const field = decimal("12.345", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 2,
    });
    expect(() => formatField(field)).toThrow("金额：小数位格式无效");
    expect(field.value).toBe("12.345");
    expect(formatField(decimal("-0.005", { maximumFractionDigits: 2 }))).toBe(
      "-0.01",
    );
    expect(formatField(decimal("", { maximumFractionDigits: 2 }))).toBe("");
  });
});
