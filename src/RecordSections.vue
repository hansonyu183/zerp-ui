<script setup lang="ts" generic="D extends object">
import { computed, ref, useId, watch } from "vue";
import { VTab, VTabs } from "vuetify/components";
import DynamicForm from "./DynamicForm.vue";
import GroupedFacts from "./GroupedFacts.vue";
import PageContentHost from "./PageContentHost.vue";
import { formFacts, groupFields } from "./details";
import type { AnyField, Fields, FieldGroup } from "./contracts";
import type { ModuleEntry } from "./business";
import { combineProtection, type EditProtection } from "./edit-guard";
import { validate } from "./validation";
const props = defineProps<{
  fields: Fields<D>;
  groups?: readonly FieldGroup<D>[];
  related: readonly ModuleEntry[];
  modelValue: D;
  scope: string;
  instance: number;
  discard?: number;
  selected?: string;
  readOnly?: boolean;
  disabled?: boolean;
  mode: "create" | "edit";
}>();
const emit = defineEmits<{
  "update:modelValue": [value: D];
  pending: [value: boolean];
  protection: [value: EditProtection];
  select: [key: string];
}>();
const id = useId(),
  selected = ref<string>(),
  pending = ref<Record<string, boolean>>({}),
  children = ref<Record<string, EditProtection>>({});
const sections = computed(() => {
  const fields = props.fields as readonly AnyField[];
  const groups = props.groups ?? [
    {
      key: "$basic",
      label: "基本资料",
      fields: fields.map((field) => field.key),
    },
  ];
  const used = new Set<string>();
  const result = groups.map((group) => {
    const local = fields.filter(
      (field) =>
        (group.fields as readonly string[]).includes(field.key) &&
        !used.has(field.key),
    );
    local.forEach((field) => used.add(field.key));
    return {
      key: group.key,
      label: group.label,
      fields: local as unknown as Fields<D>,
      page: props.related.find((entry) => entry.key === group.key)?.page,
    };
  });
  const rest = fields.filter((field) => !used.has(field.key));
  if (rest.length)
    result.push({
      key: "$other",
      label: "其他",
      fields: rest as unknown as Fields<D>,
      page: undefined,
    });
  for (const entry of props.related)
    if (!result.some((section) => section.key === entry.key))
      result.push({
        key: entry.key,
        label: entry.label,
        fields: [] as unknown as Fields<D>,
        page: entry.page,
      });
  return result;
});
watch(
  () => [props.scope, props.instance],
  () => {
    selected.value = props.selected ?? sections.value[0]?.key;
    pending.value = {};
    children.value = {};
  },
  { immediate: true },
);
watch(
  () => props.selected,
  (value) => {
    if (sections.value.some((section) => section.key === value))
      selected.value = value;
  },
);
watch(
  () => sections.value.map((section) => section.key),
  (keys) => {
    if (!keys.includes(selected.value ?? "")) selected.value = keys[0];
    pending.value = Object.fromEntries(
      Object.entries(pending.value).filter(([key]) => keys.includes(key)),
    );
    children.value = Object.fromEntries(
      Object.entries(children.value).filter(([key]) => keys.includes(key)),
    );
  },
);
watch(
  () => Object.values(pending.value).some(Boolean),
  (value) => emit("pending", value),
  { immediate: true, flush: "sync" },
);
watch(
  () => combineProtection(Object.values(children.value)),
  (value) => emit("protection", value),
  { immediate: true, flush: "sync" },
);
function select(value: unknown) {
  const key = String(value);
  if (!sections.value.some((section) => section.key === key)) return;
  selected.value = key;
  emit("select", key);
}
</script>
<template>
  <VTabs
    v-if="sections.length > 1"
    :model-value="selected"
    aria-label="资料分组"
    show-arrows
    @update:model-value="select"
  >
    <VTab
      v-for="(section, index) in sections"
      :key="section.key"
      :value="section.key"
      :id="`${id}-tab-${index}`"
      :aria-controls="`${id}-panel-${index}`"
      >{{ section.label
      }}<span
        v-if="
          !readOnly &&
          validate(section.fields as readonly AnyField[], modelValue, mode)
        "
        >待完善</span
      ></VTab
    >
  </VTabs>
  <section
    v-for="(section, index) in sections"
    :key="section.key"
    v-show="sections.length < 2 || selected === section.key"
    :id="`${id}-panel-${index}`"
    :role="sections.length > 1 ? 'tabpanel' : undefined"
    :aria-labelledby="sections.length > 1 ? `${id}-tab-${index}` : undefined"
    :class="{ 'zerp-form-panel': sections.length > 1 }"
  >
    <PageContentHost
      v-if="section.page"
      :page="section.page"
      :scope="scope"
      :discard="discard"
      embedded
      :heading="false"
      @protection="children = { ...children, [section.key]: $event }"
    />
    <template v-else-if="section.fields.length">
      <GroupedFacts
        v-if="readOnly"
        :value="modelValue"
        :groups="
          groupFields(
            formFacts(section.fields as readonly AnyField[]),
            undefined,
            section.label,
          )
        "
        :scope="scope"
        :instance="instance"
      />
      <DynamicForm
        v-else
        :fields="section.fields"
        :model-value="modelValue"
        :scope="scope"
        :disabled="disabled"
        :mode="mode"
        @update:model-value="emit('update:modelValue', $event)"
        @pending="pending = { ...pending, [section.key]: $event }"
      />
    </template>
    <p v-else>请先保存资料，再维护{{ section.label }}。</p>
  </section>
</template>
