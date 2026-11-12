<script setup lang="ts">
import {
  VBtn,
  VExpansionPanels,
  VExpansionPanel,
  VExpansionPanelTitle,
  VExpansionPanelText,
} from "vuetify/components";
import { computed, onBeforeUnmount } from "vue";
import { valueAt } from "./business-type";
import ReferencePicker from "./ReferencePicker.vue";
import { factText, type FactField } from "./details";
import type { ReferenceValue } from "./contracts";
const props = defineProps<{
  value: object;
  fields: readonly FactField[];
  scope?: string;
}>();
const parts = computed(() => {
  const groups: { key?: string; label?: string; fields: FactField[] }[] = [];
  for (const field of props.fields) {
    if (!groups.length || groups.at(-1)!.key !== field.section?.key)
      groups.push({ ...field.section, fields: [] });
    groups.at(-1)!.fields.push(field);
  }
  return groups;
});
const emit = defineEmits<{ related: [intent: unknown] }>();
let active = true;
onBeforeUnmount(() => {
  active = false;
});
function related(field: FactField, value: unknown) {
  if (
    active &&
    field.related &&
    value &&
    typeof value === "object" &&
    "id" in value
  )
    emit("related", field.related(value as ReferenceValue));
}
function get(value: object, key: string): unknown {
  return valueAt(value, key);
}
function rows(value: unknown): object[] {
  return Array.isArray(value) ? value : [];
}
</script>
<template>
  <div class="zerp-facts-container">
    <template v-for="(part, partIndex) in parts" :key="partIndex">
      <h4 v-if="part.label">{{ part.label }}</h4>
      <dl class="zerp-facts">
        <div
          v-for="field in part.fields"
          :key="field.key"
          :class="{
            'zerp-fact--wide': [
              'textarea',
              'records',
              'texts',
              'reference-list',
            ].includes(field.type),
          }"
        >
          <dt>{{ field.label }}</dt>
          <dd>
            <ReferencePicker
              v-if="field.adapter && field.valueMode === 'id'"
              :adapter="field.adapter"
              :scope="scope ?? ''"
              :label="field.label"
              disabled
              :parent="
                field.parentKey && valueAt(value, field.parentKey)
                  ? { id: String(valueAt(value, field.parentKey)), label: '' }
                  : undefined
              "
              :multiple="field.type === 'reference-list'"
              :model-value="
                Array.isArray(get(value, field.key))
                  ? (get(value, field.key) as string[]).map((id) => ({
                      id,
                      label: '',
                    }))
                  : get(value, field.key)
                    ? { id: String(get(value, field.key)), label: '' }
                    : null
              "
            />
            <template v-else-if="field.type === 'records'">
              <span v-if="!Array.isArray(get(value, field.key))">{{
                factText(get(value, field.key), field)
              }}</span>
              <p v-else-if="!rows(get(value, field.key)).length">暂无记录</p>
              <VExpansionPanels v-else variant="accordion" multiple>
                <VExpansionPanel
                  v-for="(row, index) in rows(get(value, field.key))"
                  :key="field.rowKey?.(row) ?? index"
                >
                  <VExpansionPanelTitle>
                    {{ field.label }} ·
                    {{ field.rowLabel?.(row) ?? `记录 ${index + 1}` }}
                  </VExpansionPanelTitle>
                  <VExpansionPanelText eager>
                    <FactFields
                      :value="row"
                      :scope="scope"
                      :fields="field.fields ?? []"
                      @related="active && emit('related', $event)"
                    />
                  </VExpansionPanelText>
                </VExpansionPanel>
              </VExpansionPanels>
            </template>
            <template
              v-else-if="
                field.type === 'texts' || field.type === 'reference-list'
              "
            >
              <template v-if="Array.isArray(get(value, field.key))">
                <span v-if="!(get(value, field.key) as unknown[]).length"
                  >（空列表）</span
                >
                <ul v-else>
                  <li
                    v-for="(item, index) in get(value, field.key) as unknown[]"
                    :key="index"
                  >
                    {{
                      factText(item, {
                        ...field,
                        type:
                          field.type === "reference-list"
                            ? "reference"
                            : "text",
                      })
                    }}
                  </li>
                </ul>
              </template>
              <template v-else>{{
                factText(get(value, field.key), field)
              }}</template>
            </template>
            <template v-else>
              <span>{{ factText(get(value, field.key), field) }}</span>
              <VBtn
                v-if="
                  field.type === 'reference' &&
                  field.related &&
                  get(value, field.key) != null
                "
                type="button"
                variant="text"
                color=""
                :aria-label="`查看${field.label}：${factText(get(value, field.key), field)}`"
                @click="related(field, get(value, field.key))"
              >
                查看关联
              </VBtn>
            </template>
          </dd>
        </div>
      </dl>
    </template>
  </div>
</template>
