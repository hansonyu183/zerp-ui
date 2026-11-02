<script setup lang="ts" generic="T">
import {
  VCheckbox,
  VTextField,
  VList,
  VListItem,
  VBtn,
  VTable,
  VCard,
  VCardText,
} from "vuetify/components";
import { computed, onBeforeUnmount } from "vue";
import Feedback from "./Feedback.vue";
import type { Interaction, InteractionAnswers } from "./collaboration";
const props = defineProps<{
  items: readonly Interaction<T>[];
  answers: InteractionAnswers;
  disabled?: boolean;
}>();
const dispatch = defineEmits<{
  answer: [id: string, value: string | boolean];
  intent: [target: T];
}>();
const messages = computed(() =>
  props.items.filter((item) => item.kind === "message"),
);
const controls = computed(() =>
  props.items.filter((item) => item.kind !== "message"),
);
let alive = true;
function answer(id: string, value: string | boolean) {
  if (alive && !props.disabled) dispatch("answer", id, value);
}
function intent(target: T) {
  if (alive && !props.disabled) dispatch("intent", target);
}
onBeforeUnmount(() => {
  alive = false;
});
</script>
<template>
  <div class="zerp-feedback-region" aria-label="业务消息">
    <Feedback
      v-for="item in messages"
      :key="item.id"
      :message="item.message"
      :kind="item.level"
    />
  </div>
  <section
    v-if="controls.length"
    aria-label="业务提示"
    class="zerp-interactions"
  >
    <template v-for="item in controls" :key="item.id">
      <VCheckbox
        v-if="item.kind === 'confirm'"
        :label="item.label"
        :aria-label="item.label"
        :model-value="answers[item.id] === true"
        :disabled="disabled"
        :required="item.required"
        hide-details
        @update:model-value="answer(item.id, $event === true)"
      />
      <VTextField
        v-else-if="item.kind === 'input'"
        :label="item.label"
        :aria-label="item.label"
        :model-value="String(answers[item.id] ?? '')"
        :disabled="disabled"
        :required="item.required"
        @change="answer(item.id, ($event.target as HTMLInputElement).value)"
      />
      <VCard
        v-else-if="item.kind === 'menu' || item.kind === 'tree'"
        :aria-label="item.label"
        role="region"
        variant="outlined"
        class="zerp-business-catalog"
      >
        <VCardText
          ><h3 class="text-subtitle-1">{{ item.label }}</h3>
          <VList :aria-label="item.label">
            <VListItem v-for="entry in item.items" :key="entry.key">
              <VBtn
                type="button"
                variant="text"
                color=""
                :disabled="disabled || entry.disabled"
                @click="intent(entry.target)"
                >{{ entry.label }}</VBtn
              >
              <VList
                v-if="entry.children"
                :aria-label="`${entry.label}子项`"
                class="zerp-business-children"
              >
                <VListItem v-for="child in entry.children" :key="child.key">
                  <VBtn
                    type="button"
                    variant="text"
                    color=""
                    :disabled="disabled || entry.disabled || child.disabled"
                    @click="intent(child.target)"
                    >{{ child.label }}</VBtn
                  >
                </VListItem>
              </VList>
            </VListItem>
          </VList></VCardText
        >
      </VCard>
      <div v-else-if="item.kind === 'grid'" class="zerp-table-scroll">
        <VTable>
          <caption>
            {{
              item.label
            }}
          </caption>
          <thead>
            <tr>
              <th v-for="column in item.columns" :key="column.key" scope="col">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in item.rows" :key="row.key">
              <td v-for="column in item.columns" :key="column.key">
                {{ row.values[column.key] ?? "—" }}
              </td>
            </tr>
          </tbody>
        </VTable>
      </div>
      <VBtn
        v-else-if="item.kind === 'related' || item.kind === 'download'"
        type="button"
        variant="text"
        color=""
        :disabled="disabled"
        @click="intent(item.target)"
        >{{ item.label }}</VBtn
      >
    </template>
  </section>
</template>
