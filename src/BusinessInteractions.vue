<script setup lang="ts" generic="T">
import {
  VCheckbox,
  VTextField,
  VSelect,
  VList,
  VListItem,
  VBtn,
  VTable,
  VCard,
  VCardText,
} from "vuetify/components";
import { computed, onBeforeUnmount } from "vue";
import { useDisplay } from "vuetify";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
import type { Interaction, InteractionAnswers } from "./collaboration";
import { plainClick, renderedHref } from "./model-target";
const { xs } = useDisplay();
const props = defineProps<{
  items: readonly Interaction<T>[];
  answers: InteractionAnswers;
  disabled?: boolean;
  answersDisabled?: boolean;
  href?: (target: T) => string | undefined;
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
  if (alive && !props.disabled && !props.answersDisabled)
    dispatch("answer", id, value);
}
function intent(target: T, event: MouseEvent) {
  if (!alive || props.disabled) {
    event.preventDefault();
    return;
  }
  const href = props.href?.(target);
  const previousHref = renderedHref(event);
  if ((href || previousHref !== null) && href !== previousHref) {
    event.preventDefault();
    return;
  }
  if (href) {
    if (!plainClick(event)) return;
    event.preventDefault();
  }
  dispatch("intent", target);
}
onBeforeUnmount(() => {
  alive = false;
});
</script>
<template>
  <FeedbackRegion aria-label="业务消息">
    <Feedback
      v-for="item in messages"
      :key="item.id"
      :message="item.message"
      :kind="item.level"
    />
  </FeedbackRegion>
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
        :disabled="disabled || answersDisabled"
        :required="item.required"
        hide-details
        @update:model-value="answer(item.id, $event === true)"
      />
      <VSelect
        v-else-if="item.kind === 'input' && item.options"
        :label="item.label"
        :aria-label="item.label"
        :items="item.options"
        item-title="label"
        item-value="value"
        :model-value="String(answers[item.id] ?? '')"
        :disabled="disabled || answersDisabled"
        :required="item.required"
        @update:model-value="answer(item.id, String($event ?? ''))"
      />
      <VTextField
        v-else-if="item.kind === 'input'"
        :label="item.label"
        :aria-label="item.label"
        :model-value="String(answers[item.id] ?? '')"
        :disabled="disabled || answersDisabled"
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
          ><h3>{{ item.label }}</h3>
          <VList :aria-label="item.label">
            <VListItem v-for="entry in item.items" :key="entry.key">
              <VBtn
                type="button"
                variant="text"
                color=""
                :disabled="disabled || entry.disabled"
                :href="href?.(entry.target)"
                @click="intent(entry.target, $event)"
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
                    :href="href?.(child.target)"
                    @click="intent(child.target, $event)"
                    >{{ child.label }}</VBtn
                  >
                </VListItem>
              </VList>
            </VListItem>
          </VList></VCardText
        >
      </VCard>
      <div v-else-if="item.kind === 'grid'" class="zerp-table-scroll">
        <component
          :is="xs ? 'div' : VTable"
          :aria-label="item.label"
          density="compact"
          class="zerp-compact-table"
        >
          <component :is="xs ? 'h3' : 'caption'">
            {{ item.label }}
          </component>
          <thead v-if="!xs">
            <tr>
              <th v-for="column in item.columns" :key="column.key" scope="col">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <component
            :is="xs ? 'div' : 'tbody'"
            :class="{ 'zerp-record-cards': xs }"
          >
            <component
              :is="xs ? VCard : 'tr'"
              :tag="xs ? 'article' : undefined"
              :variant="xs ? 'flat' : undefined"
              :border="xs || undefined"
              :class="{ 'zerp-record-card': xs }"
              v-for="row in item.rows"
              :key="row.key"
            >
              <component
                :is="xs ? 'div' : 'td'"
                v-for="column in item.columns"
                :key="column.key"
                :data-label="column.label"
              >
                <span v-if="xs" class="zerp-record-card__label">{{
                  column.label
                }}</span>
                {{ row.values[column.key] ?? "—" }}
              </component>
            </component>
          </component>
        </component>
      </div>
      <VBtn
        v-else-if="item.kind === 'related' || item.kind === 'download'"
        :class="{ 'zerp-interactions__related': item.kind === 'related' }"
        type="button"
        variant="text"
        color=""
        :disabled="disabled || item.disabled"
        :href="href?.(item.target)"
        @click="intent(item.target, $event)"
        >{{ item.label }}</VBtn
      >
    </template>
  </section>
</template>

<style scoped>
@media (max-width: 599px) {
  .zerp-interactions {
    display: flex;
    flex-wrap: wrap;
  }
  .zerp-interactions > :not(.zerp-interactions__related) {
    flex: 0 0 100%;
    min-inline-size: 0;
  }
  .zerp-interactions__related {
    block-size: auto;
    max-inline-size: 100%;
  }
  .zerp-interactions__related :deep(.v-btn__content) {
    min-inline-size: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>
