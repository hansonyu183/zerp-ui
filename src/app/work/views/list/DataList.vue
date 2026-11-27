<script
  setup
  lang="ts"
  generic="
    R extends object,
    T = never,
    K extends string | number = string | number
  "
>
// 渲染投影后的列表，在桌面使用表格、手机使用卡片，并处理行操作和报表呈现。
import {
  plainClick,
  renderedHref,
  renderedTarget,
} from "../../../../components/links";
import Feedback from "../../../../components/feedback/Feedback.vue";
import FeedbackRegion from "../../../../components/feedback/FeedbackRegion.vue";
import { VBtn, VCard, VTable } from "vuetify/components";
import { computed } from "vue";
import { useDisplay } from "vuetify";
import RowActions from "./RowActions.vue";
import type { RowAction } from "./row-action";
import {
  validateReportColumns,
  resolveReportGroups,
  validateReportSummary,
  type ReportCell,
} from "./report";
import type {
  ReportAppearance,
  ReportPresentation,
  ReportSummary,
} from "../../../../model/report";
import type { Column, Page } from "./types";

const props = withDefaults(
  defineProps<{
    columns: readonly Column<R>[];
    result: Page<R>;
    page: number;
    pageSize: number;
    actions?: (row: R) => readonly RowAction[];
    showAllActions?: (row: R) => boolean;
    disabledActions?: (
      row: R,
      actions: readonly RowAction[],
    ) => Readonly<Partial<Record<RowAction, string>>>;
    pagingDisabled?: boolean;
    resultState?: "loading" | "success" | "failure";
    rowKey: (row: R) => K;
    summary?: ReportSummary<R>;
    presentation?: ReportPresentation<R, K>;
    cell?: (row: R, key: Extract<keyof R, string>) => ReportCell<T> | undefined;
  }>(),
  { resultState: "success" },
);
const emit = defineEmits<{
  cell: [cell: ReportCell<T>];
  page: [value: number];
  action: [action: RowAction, row: R];
}>();
const { xs } = useDisplay();
const loading = computed(() => props.resultState === "loading");
const report = computed(() => {
  try {
    validateReportColumns(props.columns);
    const fields = new Set(props.columns.map(({ key }) => key));
    const groups = resolveReportGroups(
      fields,
      props.result.items,
      props.rowKey,
      props.presentation,
    );
    if (props.summary) validateReportSummary(fields, props.summary);
    return { groups, error: "" };
  } catch (caught) {
    return {
      groups: [],
      error: caught instanceof Error ? caught.message : "列表呈现不正确。",
    };
  }
});
const rowStyles = computed(
  () => new Map(props.presentation?.rows.map((row) => [row.rowId, row])),
);
function presentationStyle(row: R, key?: Extract<keyof R, string>) {
  const fact = rowStyles.value.get(props.rowKey(row));
  const appearance: ReportAppearance = {
    ...fact?.appearance,
    ...(key ? fact?.cells?.[key] : undefined),
  };
  return {
    color: appearance.foreground,
    backgroundColor: appearance.background,
    fontWeight:
      appearance.bold === undefined
        ? undefined
        : appearance.bold
          ? "bold"
          : "normal",
    fontStyle:
      appearance.italic === undefined
        ? undefined
        : appearance.italic
          ? "italic"
          : "normal",
    textAlign: appearance.align,
  };
}
type Group = ReportPresentation<R, K>["groups"][number];
// 按行键定位组头和小计，同一结束行先显示内层小计。
const groupEdges = computed(() => {
  const start = new Map<K, Group[]>(),
    end = new Map<K, Group[]>();
  for (const group of report.value.groups) {
    const first = start.get(group.firstKey) ?? [];
    first.push(group);
    start.set(group.firstKey, first);
    const last = end.get(group.lastKey) ?? [];
    last.push(group);
    end.set(group.lastKey, last);
  }
  for (const list of end.values()) list.sort((a, b) => b.level - a.level);
  return { start, end };
});
function groups(row: R, start: boolean) {
  return groupEdges.value[start ? "start" : "end"].get(props.rowKey(row)) ?? [];
}
const colspan = computed(() => props.columns.length + 1);
const rowActions = computed(() =>
  props.result.items.map((row) => props.actions?.(row) ?? []),
);
type DisplayColumn =
  | { kind: "data"; key: string; column: Column<R> }
  | { kind: "actions"; key: string };
const displayColumns = computed(() => {
  const data: DisplayColumn[] = props.columns.map((column) => ({
    kind: "data" as const,
    key: `field:${column.key}`,
    column,
  }));
  if (!xs.value) data.splice(1, 0, { kind: "actions", key: "actions" });
  return data;
});
function dispatch(action: RowAction, row: R) {
  if (loading.value || report.value.error) return;
  const actions = rowActions.value[props.result.items.indexOf(row)];
  if (
    actions?.includes(action) &&
    !props.disabledActions?.(row, actions)[action]
  )
    emit("action", action, row);
}
function activateCell(
  event: MouseEvent | KeyboardEvent,
  row: R,
  key: Extract<keyof R, string>,
) {
  if (report.value.error || !props.result.items.includes(row)) {
    event.preventDefault();
    return;
  }
  const intent = props.cell?.(row, key);
  if (
    !intent ||
    (intent.kind === "record" && renderedHref(event) !== intent.href) ||
    (intent.kind !== "record" && renderedTarget(event) !== intent.stamp)
  ) {
    event.preventDefault();
    return;
  }
  if (intent.kind === "record" && !plainClick(event)) return;
  event.preventDefault();
  emit("cell", intent);
}
function display(row: Partial<R>, key: Extract<keyof R, string>) {
  const value = Object.hasOwn(row, key) ? row[key] : undefined;
  return value === null || value === undefined
    ? "—"
    : value === ""
      ? "（空字符串）"
      : String(value);
}
</script>
<template>
  <div
    class="zerp-list"
    :class="{ 'zerp-list--cards': xs }"
    :aria-busy="loading"
  >
    <FeedbackRegion
      ><Feedback :message="report.error" kind="error"
    /></FeedbackRegion>
    <template v-if="!report.error && (!loading || result.items.length)">
      <p v-if="summary">{{ summary.caption }}</p>
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
            >
              <template v-if="entry.kind === 'actions'">操作</template>
              <template v-else>{{ entry.column.label }}</template>
            </th>
          </tr>
        </thead>
        <component
          :is="xs ? 'div' : 'tbody'"
          :class="{ 'zerp-record-cards': xs }"
        >
          <template v-for="(row, index) in result.items" :key="rowKey(row)">
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
              :data-record-key="String(rowKey(row))"
              :variant="xs ? 'flat' : undefined"
              :border="xs || undefined"
              :class="{ 'zerp-record-card': xs }"
              :aria-label="xs ? `记录 ${index + 1}` : undefined"
              :style="presentationStyle(row)"
            >
              <div v-if="xs" class="zerp-record-card__toolbar">
                <RowActions
                  :actions="rowActions[index]!"
                  :show-all="showAllActions?.(row)"
                  :reasons="disabledActions?.(row, rowActions[index]!)"
                  :busy="loading"
                  @action="dispatch($event, row)"
                />
              </div>
              <component
                :is="xs ? 'div' : 'td'"
                v-for="entry in displayColumns"
                :key="entry.key"
                :data-label="
                  entry.kind === 'data' ? entry.column.label : '操作'
                "
                :class="{ 'zerp-list__actions': entry.kind === 'actions' }"
                :style="
                  entry.kind === 'data'
                    ? presentationStyle(row, entry.column.key)
                    : undefined
                "
              >
                <RowActions
                  v-if="entry.kind === 'actions'"
                  :actions="rowActions[index]!"
                  :show-all="showAllActions?.(row)"
                  :reasons="disabledActions?.(row, rowActions[index]!)"
                  :busy="loading"
                  @action="dispatch($event, row)"
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
                      v-if="intent?.kind === 'record'"
                      :href="intent.href"
                      :aria-label="intent.label"
                      :style="presentationStyle(row, entry.column.key)"
                      @click="activateCell($event, row, entry.column.key)"
                      >{{ display(row, entry.column.key) }}</a
                    >
                    <VBtn
                      v-else-if="intent"
                      variant="text"
                      color="on-surface"
                      type="button"
                      :aria-label="intent.label"
                      :data-target="intent.stamp"
                      :style="presentationStyle(row, entry.column.key)"
                      @click="activateCell($event, row, entry.column.key)"
                    >
                      {{ display(row, entry.column.key) }}
                    </VBtn>
                    <template v-else>{{
                      display(row, entry.column.key)
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
                  <span v-if="entry.column === columns[0]"
                    >{{ group.summary.caption
                    }}{{ group.continuedAfter ? "（续）" : "" }}</span
                  >{{
                    Object.hasOwn(group.summary.values, entry.column.key)
                      ? display(group.summary.values, entry.column.key)
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
                >{{ display(summary.values, entry.column.key) }}</template
              >
            </component>
          </component>
        </component>
      </component>
      <p v-if="resultState === 'success' && !loading && !result.items.length">
        暂无记录
      </p>
      <nav
        v-if="
          result.items.length ||
          (resultState === 'success' && page > 1 && result.total > 0)
        "
        aria-label="分页"
      >
        <VBtn
          type="button"
          :disabled="page <= 1 || loading || pagingDisabled"
          @click="emit('page', page - 1)"
        >
          上一页</VBtn
        ><span
          >第 {{ page }} 页 /
          {{ Math.max(1, Math.ceil(result.total / pageSize)) }} 页 · 共
          {{ result.total }} 条</span
        >
        <VBtn
          type="button"
          :disabled="
            pagingDisabled || loading || page * pageSize >= result.total
          "
          @click="emit('page', page + 1)"
        >
          下一页
        </VBtn>
      </nav>
    </template>
  </div>
</template>
