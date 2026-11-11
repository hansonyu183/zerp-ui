<script
  setup
  lang="ts"
  generic="
    R extends object,
    T = never,
    A extends ListAction = CrudAction,
    K extends string | number = string | number
  "
>
import Feedback from "./Feedback.vue";
import { valueAt } from "./model";
import FeedbackRegion from "./FeedbackRegion.vue";
import { VBtn, VCard, VCheckboxBtn, VTable } from "vuetify/components";
import { computed } from "vue";
import { useDisplay } from "vuetify";
import RowActions from "./RowActions.vue";
import type { RecordLink } from "./shell";
import {
  validateReportColumns,
  validateReportPresentation,
  validateReportSummary,
} from "./report";
import type {
  ReportCell,
  ReportSummary,
  ReportPresentation,
  ReportAppearance,
} from "./report";
import type {
  Column,
  Page,
  CrudAction,
  ListAction,
  ListSort,
} from "./contracts";
const props = defineProps<{
  columns: readonly Column<R>[];
  labels?: (
    row: R,
  ) => Readonly<Partial<Record<Extract<keyof R, string>, string>>>;
  sort?: ListSort;
  result: Page<R>;
  page: number;
  pageSize: number;
  loading?: boolean;
  selectedKeys?: readonly (string | number)[];
  selectable?: (row: R) => boolean;
  actions?: (row: R) => readonly A[];
  viewHref?: (row: R) => string | undefined;
  rowLinks?: (row: R) => readonly RecordLink[];
  disabled?: boolean;
  wide?: boolean;
  rowKey?: (row: R) => K;
  summary?: ReportSummary<R>;
  presentation?: ReportPresentation<R, K>;
  cell?: (row: R, key: Extract<keyof R, string>) => ReportCell<T> | undefined;
}>();
const { xs } = useDisplay();
const presentationError = computed(() => {
  try {
    validateReportColumns(props.columns);
    validateReportPresentation(
      props.columns,
      props.result.items,
      props.rowKey,
      props.presentation,
    );
    if (props.summary) validateReportSummary(props.columns, props.summary);
    return "";
  } catch (caught) {
    return caught instanceof Error ? caught.message : "列表呈现不正确。";
  }
});
const presentationStyle = (row: R, key?: Extract<keyof R, string>) => {
  const p = props.presentation?.rows.find(
    (entry) => entry.rowId === props.rowKey?.(row),
  );
  const a: ReportAppearance = {
    ...p?.appearance,
    ...(key ? p?.cells?.[key] : {}),
  };
  const color = (v: string | undefined) =>
    v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
  return {
    color: color(a.foreground),
    backgroundColor: color(a.background),
    fontWeight: a.bold === undefined ? undefined : a.bold ? "bold" : "normal",
    fontStyle:
      a.italic === undefined ? undefined : a.italic ? "italic" : "normal",
    textAlign: a.align,
  };
};
const groups = (row: R, start: boolean) =>
  props.presentation?.groups
    .filter((g) => (start ? g.firstKey : g.lastKey) === props.rowKey?.(row))
    .slice()
    .sort((a, b) => (start ? a.level - b.level : b.level - a.level)) ?? [];
const colspan = computed(
  () =>
    dataColumns.value.length +
    (props.selectedKeys !== undefined ? 1 : 0) +
    (hasActions.value ? 1 : 0),
);
const emit = defineEmits<{
  "update:selectedKeys": [keys: (string | number)[]];
  cell: [cell: ReportCell<T>, row: R];
  page: [value: number];
  action: [action: A, row: R];
  sort: [value: ListSort];
}>();
const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
);
const rowActions = computed(() =>
  props.result.items.map((row) => props.actions?.(row) ?? []),
);
const actionColumns = computed(() =>
  visibleColumns.value.filter((column) => column.role === "action"),
);
const dataColumns = computed(() =>
  visibleColumns.value.filter((column) => column.role !== "action"),
);
const hasActions = computed(
  () =>
    rowActions.value.some((actions) => actions.length) ||
    actionColumns.value.length > 0 ||
    props.result.items.some((row) => props.rowLinks?.(row).length),
);
const displayColumns = computed(() => {
  const data = dataColumns.value.map((column) => ({
    kind: "data" as const,
    key: `field:${column.key}`,
    column,
  }));
  if (xs.value) return data;
  const first =
    props.selectedKeys !== undefined
      ? [{ kind: "selection" as const, key: "selection" }]
      : data.splice(0, 1);
  return [
    ...first,
    ...(hasActions.value ? [{ kind: "actions" as const, key: "actions" }] : []),
    ...data,
  ];
});
function cellActions(row: R) {
  return [
    ...(props.rowLinks?.(row) ?? []).map((link) => ({
      ...link,
      key: "link:" + link.key,
      disabled: false,
    })),
    ...actionColumns.value.flatMap((column) => {
      const intent = props.cell?.(row, column.key);
      return intent
        ? [
            {
              key: column.key,
              label: intent.label,
              disabled: intent.disabled,
              href: intent.kind === "record" ? intent.href : undefined,
            },
          ]
        : [];
    }),
  ];
}
// Without a consumer key, retain object identity rather than rebinding an open menu by array index.
// Selection and report presentation still require the consumer's exact rowKey.
const objectKeys = new WeakMap<R, symbol>();
function renderKey(row: R) {
  if (props.rowKey) return props.rowKey(row);
  let key = objectKeys.get(row);
  if (!key) {
    key = Symbol();
    objectKeys.set(row, key);
  }
  return key;
}
function identity(row: R) {
  if (!props.rowKey) throw Error("Selectable DataList requires rowKey");
  return props.rowKey(row);
}
const eligible = computed(() =>
  props.result.items.filter((row) => props.selectable?.(row) !== false),
);
const allSelected = computed(
  () =>
    eligible.value.length > 0 &&
    eligible.value.every((row) => props.selectedKeys?.includes(identity(row))),
);
const selectedCount = computed(
  () =>
    eligible.value.filter((row) => props.selectedKeys?.includes(identity(row)))
      .length,
);
function selectRows(rows: readonly R[], selected: boolean) {
  if (props.disabled || props.loading || presentationError.value) return;
  const keys = new Set(props.selectedKeys ?? []);
  for (const row of rows) {
    if (!props.result.items.includes(row) || props.selectable?.(row) === false)
      continue;
    const key = identity(row);
    if (selected) keys.add(key);
    else keys.delete(key);
  }
  const visible = new Set<string | number>(eligible.value.map(identity));
  emit(
    "update:selectedKeys",
    [...keys].filter((key) => visible.has(key)),
  );
}
function dispatch(action: ListAction, row: R) {
  if (
    !props.disabled &&
    !props.loading &&
    !presentationError.value &&
    props.result.items.includes(row) &&
    props.actions?.(row).includes(action as A)
  )
    emit("action", action as A, row);
}
function activateCell(
  event: MouseEvent | KeyboardEvent,
  row: R,
  key: Extract<keyof R, string>,
) {
  if (
    props.disabled ||
    presentationError.value ||
    !props.result.items.includes(row)
  ) {
    event.preventDefault();
    return;
  }
  if (props.rowLinks?.(row).some((link) => "link:" + link.key === key)) {
    if (props.loading) event.preventDefault();
    return;
  }
  const intent = props.cell?.(row, key);
  if (!intent || intent.disabled) {
    event.preventDefault();
    return;
  }
  if (
    intent.kind !== "record" ||
    (!event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      (!(event instanceof MouseEvent) || event.button === 0))
  )
    emit("cell", intent, row);
}
function displayRow(row: R, column: Column<R>) {
  return props.labels?.(row)[column.key] ?? display(row, column);
}
function display(row: Partial<R>, column: Column<R>) {
  const value = valueAt(row, column.key);
  return value === null || value === undefined
    ? "—"
    : value === ""
      ? "（空字符串）"
      : column.type === "boolean"
        ? value
          ? "是"
          : "否"
        : column.type === "enum"
          ? (column.options?.find((option) => option.value === value)?.label ??
            String(value))
          : String(value);
}
</script>
<template>
  <div
    class="zerp-list"
    :class="{ 'zerp-list--wide': wide && !xs, 'zerp-list--cards': xs }"
    :aria-busy="loading"
  >
    <FeedbackRegion
      ><Feedback :message="presentationError" kind="error"
    /></FeedbackRegion>
    <template v-if="!presentationError">
      <p v-if="summary">{{ summary.caption }}</p>
      <div v-if="xs && selectedKeys !== undefined" class="zerp-card-selection">
        <VCheckboxBtn
          aria-label="全选当前页"
          label="全选当前页"
          :model-value="allSelected"
          :indeterminate="
            !allSelected &&
            eligible.some((row) => selectedKeys?.includes(identity(row)))
          "
          :disabled="disabled || loading || !eligible.length"
          @update:model-value="selectRows(eligible, !!$event)"
        />
        <span role="status">已选 {{ selectedCount }} 项</span>
      </div>
      <component
        :is="xs ? 'div' : VTable"
        :hover="!xs"
        density="compact"
        class="zerp-compact-table"
      >
        <thead v-if="!xs">
          <tr>
            <th
              v-for="entry in displayColumns"
              :key="entry.key"
              scope="col"
              :class="{ 'zerp-list__actions': entry.kind === 'actions' }"
              :style="
                entry.kind === 'data'
                  ? { maxWidth: entry.column.width }
                  : undefined
              "
            >
              <VCheckboxBtn
                v-if="entry.kind === 'selection'"
                aria-label="全选当前页"
                :model-value="allSelected"
                :indeterminate="
                  !allSelected &&
                  eligible.some((row) => selectedKeys?.includes(identity(row)))
                "
                :disabled="disabled || loading || !eligible.length"
                @update:model-value="selectRows(eligible, !!$event)"
              />
              <template v-else-if="entry.kind === 'actions'">操作</template>
              <VBtn
                v-else-if="sort"
                type="button"
                variant="text"
                :disabled="disabled || loading"
                @click="
                  emit('sort', {
                    key: entry.column.key,
                    direction:
                      sort.key === entry.column.key && sort.direction === 'asc'
                        ? 'desc'
                        : 'asc',
                  })
                "
                >{{ entry.column.label
                }}{{
                  sort.key === entry.column.key
                    ? sort.direction === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""
                }}</VBtn
              >
              <template v-else>{{ entry.column.label }}</template>
            </th>
          </tr>
        </thead>
        <component
          :is="xs ? 'div' : 'tbody'"
          :class="{ 'zerp-record-cards': xs }"
        >
          <template v-for="(row, index) in result.items" :key="renderKey(row)">
            <component
              :is="xs ? 'div' : 'tr'"
              v-for="group in groups(row, true)"
              :key="'group-start:' + group.id"
              class="zerp-report-group"
            >
              <component
                :is="xs ? 'h2' : 'th'"
                :colspan="xs ? undefined : colspan"
                :scope="xs ? undefined : 'rowgroup'"
              >
                {{ group.label }}{{ group.continuedBefore ? "（续）" : "" }}
              </component>
            </component>
            <component
              :is="xs ? VCard : 'tr'"
              :tag="xs ? 'article' : undefined"
              :variant="xs ? 'outlined' : undefined"
              :class="{
                'zerp-record-card': xs,
                'zerp-record-card--selected':
                  xs && selectedKeys?.includes(identity(row)),
              }"
              :aria-label="xs ? `记录 ${index + 1}` : undefined"
              :style="presentationStyle(row)"
            >
              <div
                v-if="xs && (selectedKeys !== undefined || hasActions)"
                class="zerp-record-card__toolbar"
              >
                <VCheckboxBtn
                  v-if="selectedKeys !== undefined"
                  :aria-label="`选择 ${identity(row)}`"
                  :model-value="selectedKeys.includes(identity(row))"
                  :disabled="disabled || loading || selectable?.(row) === false"
                  @update:model-value="selectRows([row], !!$event)"
                />
                <RowActions
                  v-if="hasActions"
                  :actions="rowActions[index]!"
                  :entries="cellActions(row)"
                  :busy="loading"
                  :disabled="disabled"
                  :view-href="viewHref?.(row)"
                  @action="dispatch($event, row)"
                  @cell="
                    (event, key) =>
                      activateCell(event, row, key as Extract<keyof R, string>)
                  "
                />
              </div>
              <component
                :is="xs ? 'div' : 'td'"
                v-for="entry in displayColumns"
                :key="entry.key"
                :data-label="
                  entry.kind === 'data'
                    ? entry.column.label
                    : entry.kind === 'actions'
                      ? '操作'
                      : '选择'
                "
                :class="{ 'zerp-list__actions': entry.kind === 'actions' }"
                :style="
                  entry.kind === 'data'
                    ? {
                        ...presentationStyle(row, entry.column.key),
                        maxWidth: entry.column.width,
                      }
                    : undefined
                "
              >
                <VCheckboxBtn
                  v-if="entry.kind === 'selection'"
                  :aria-label="`选择 ${identity(row)}`"
                  :model-value="selectedKeys?.includes(identity(row))"
                  :disabled="disabled || loading || selectable?.(row) === false"
                  @update:model-value="selectRows([row], !!$event)"
                />
                <RowActions
                  v-else-if="entry.kind === 'actions'"
                  :actions="rowActions[index]!"
                  :entries="cellActions(row)"
                  :disabled="disabled"
                  :busy="loading"
                  :view-href="viewHref?.(row)"
                  @action="dispatch($event, row)"
                  @cell="
                    (event, key) =>
                      activateCell(event, row, key as Extract<keyof R, string>)
                  "
                />
                <template v-else>
                  <span v-if="xs" class="zerp-record-card__label">{{
                    entry.column.label
                  }}</span>
                  <template
                    v-for="intent in [cell?.(row, entry.column.key)]"
                    :key="entry.column.key"
                  >
                    <a
                      v-if="
                        intent?.kind === 'record' &&
                        !disabled &&
                        !intent.disabled
                      "
                      :style="presentationStyle(row, entry.column.key)"
                      :href="intent.href"
                      :aria-label="intent.label"
                      @click="activateCell($event, row, entry.column.key)"
                      >{{ displayRow(row, entry.column) }}</a
                    >
                    <VBtn
                      v-else-if="intent"
                      variant="text"
                      color="on-surface"
                      type="button"
                      :aria-label="intent.label"
                      :style="presentationStyle(row, entry.column.key)"
                      :disabled="disabled || intent.disabled"
                      @click="activateCell($event, row, entry.column.key)"
                    >
                      {{ displayRow(row, entry.column) }}
                    </VBtn>
                    <template v-else>{{
                      displayRow(row, entry.column)
                    }}</template>
                  </template>
                </template>
              </component>
            </component>
            <component
              :is="xs ? VCard : 'tr'"
              :tag="xs ? 'section' : undefined"
              :variant="xs ? 'tonal' : undefined"
              v-for="group in groups(row, false)"
              :key="'group-end:' + group.id"
              class="zerp-report-group-summary"
            >
              <component
                :is="xs ? 'div' : 'td'"
                v-for="entry in displayColumns"
                :key="entry.key"
                :data-label="
                  entry.kind === 'data' ? entry.column.label : undefined
                "
              >
                <template v-if="entry.kind === 'data'">
                  <span v-if="xs" class="zerp-record-card__label">{{
                    entry.column.label
                  }}</span>
                  <span v-if="entry.column === dataColumns[0]"
                    >{{ group.summary.caption
                    }}{{ group.continuedAfter ? "（续）" : "" }}</span
                  >{{
                    Object.hasOwn(group.summary.values, entry.column.key)
                      ? display(group.summary.values, entry.column)
                      : ""
                  }}
                </template>
              </component>
            </component>
          </template>
        </component>
        <component
          :is="xs ? VCard : 'tfoot'"
          :tag="xs ? 'section' : undefined"
          :variant="xs ? 'tonal' : undefined"
          v-if="summary"
          :aria-label="summary.caption"
        >
          <component :is="xs ? 'div' : 'tr'">
            <component
              :is="xs ? 'div' : 'td'"
              v-for="entry in displayColumns"
              :key="entry.key"
              :data-label="
                entry.kind === 'data' ? entry.column.label : undefined
              "
            >
              <template v-if="entry.kind === 'data'"
                ><span v-if="xs" class="zerp-record-card__label">{{
                  entry.column.label
                }}</span
                >{{ display(summary.values, entry.column) }}</template
              >
            </component>
          </component>
        </component>
      </component>
      <p v-if="!loading && !result.items.length">暂无数据</p>
      <nav aria-label="分页">
        <VBtn
          type="button"
          :disabled="page <= 1 || loading || disabled"
          @click="emit('page', page - 1)"
        >
          上一页</VBtn
        ><span
          >第 {{ page }} 页<span v-if="result.total !== undefined">
            / {{ Math.max(1, Math.ceil(result.total / pageSize)) }} 页 · 共
            {{ result.total }} 条</span
          ></span
        ><VBtn
          type="button"
          :disabled="
            disabled ||
            loading ||
            (result.total !== undefined
              ? page * pageSize >= result.total
              : !result.hasMore)
          "
          @click="emit('page', page + 1)"
        >
          下一页
        </VBtn>
      </nav>
    </template>
  </div>
</template>
