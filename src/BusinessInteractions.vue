<script setup lang="ts" generic="T">
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
  <section v-if="controls.length" aria-label="业务提示">
    <template v-for="item in controls" :key="item.id">
      <label v-if="item.kind === 'confirm'"
        >{{ item.label
        }}<input
          type="checkbox"
          :checked="answers[item.id] === true"
          :disabled="disabled"
          @change="
            answer(item.id, ($event.target as HTMLInputElement).checked)
          "
      /></label>
      <label v-else-if="item.kind === 'input'"
        >{{ item.label
        }}<input
          type="text"
          :value="answers[item.id] ?? ''"
          :disabled="disabled"
          @change="answer(item.id, ($event.target as HTMLInputElement).value)"
      /></label>
      <section
        v-else-if="item.kind === 'menu' || item.kind === 'tree'"
        :aria-label="item.label"
      >
        <ul>
          <li v-for="entry in item.items" :key="entry.key">
            <button
              type="button"
              :disabled="disabled || entry.disabled"
              @click="intent(entry.target)"
            >
              {{ entry.label }}
            </button>
            <ul v-if="entry.children">
              <li v-for="child in entry.children" :key="child.key">
                <button
                  type="button"
                  :disabled="disabled || entry.disabled || child.disabled"
                  @click="intent(child.target)"
                >
                  {{ child.label }}
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </section>
      <div v-else-if="item.kind === 'grid'" class="zerp-table-scroll">
        <table>
          <caption>
            {{
              item.label
            }}
          </caption>
          <thead>
            <tr>
              <th v-for="column in item.columns" :key="column.key">
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
        </table>
      </div>
      <button
        v-else-if="item.kind === 'related' || item.kind === 'download'"
        type="button"
        :disabled="disabled"
        @click="intent(item.target)"
      >
        {{ item.label }}
      </button>
    </template>
  </section>
</template>
