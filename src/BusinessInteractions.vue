<script setup lang="ts" generic="T">
import Feedback from "./Feedback.vue";
import type { Interaction, InteractionAnswers } from "./collaboration";
defineProps<{
  items: readonly Interaction<T>[];
  answers: InteractionAnswers;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  answer: [id: string, value: string | boolean];
  intent: [target: T];
}>();
</script>
<template>
  <section v-if="items.length" aria-label="业务提示">
    <template v-for="item in items" :key="item.id">
      <Feedback
        v-if="item.kind === 'message'"
        :message="item.message"
        :kind="item.level"
      />
      <label v-else-if="item.kind === 'confirm'"
        >{{ item.label
        }}<input
          type="checkbox"
          :checked="answers[item.id] === true"
          :disabled="disabled"
          @change="
            emit('answer', item.id, ($event.target as HTMLInputElement).checked)
          "
      /></label>
      <label v-else-if="item.kind === 'input'"
        >{{ item.label
        }}<input
          type="text"
          :value="answers[item.id] ?? ''"
          :disabled="disabled"
          @change="
            emit('answer', item.id, ($event.target as HTMLInputElement).value)
          "
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
              @click="emit('intent', entry.target)"
            >
              {{ entry.label }}
            </button>
            <ul v-if="entry.children">
              <li v-for="child in entry.children" :key="child.key">
                <button
                  type="button"
                  :disabled="disabled || entry.disabled || child.disabled"
                  @click="emit('intent', child.target)"
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
        @click="emit('intent', item.target)"
      >
        {{ item.label }}
      </button>
    </template>
  </section>
</template>
