// 只复制比较所需的业务值，原节点及操作始终由消费者持有。
import type { FieldNode, ObjectNode } from "../../../model/business-model";

type RecordValues = Record<string, unknown>;

function copyValue(value: FieldNode["value"]): unknown {
  if (Array.isArray(value))
    return value.map((entry) => (entry instanceof File ? entry : { ...entry }));
  return value && typeof value === "object" ? { ...value } : value;
}

export function recordValues(
  record: ObjectNode,
  previous?: RecordValues,
): RecordValues {
  return Object.fromEntries(
    record.members.flatMap((member) => {
      if (member.kind === "object") {
        const baseline = previous?.[member.key] as RecordValues | undefined;
        const values =
          member.operations.update && baseline
            ? baseline
            : recordValues(member, baseline);
        return [[member.key, values]];
      }
      if (member.kind === "records")
        return [
          [
            member.key,
            member.items.map((row) => [
              row.identity,
              row.key,
              recordValues(row),
            ]),
          ],
        ];
      if (member.kind === "output" || member.kind === "interactions") return [];
      return [[member.key, copyValue(member.value)]];
    }),
  );
}

export function edited(record: ObjectNode, baseline: RecordValues) {
  return !equalValues(recordValues(record), baseline);
}

export function updateBaseline(
  record: ObjectNode,
  baseline: RecordValues,
  target: ObjectNode,
): RecordValues {
  if (record === target) return recordValues(target, baseline);
  for (const member of record.members) {
    if (member.kind !== "object") continue;
    const previous = baseline[member.key] as RecordValues;
    const next = updateBaseline(member, previous, target);
    if (next !== previous) return { ...baseline, [member.key]: next };
  }
  return baseline;
}

function equalValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (a instanceof File || b instanceof File) return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => equalValues(value, b[i]))
    );
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && equalValues(left[key], right[key]),
    )
  );
}
