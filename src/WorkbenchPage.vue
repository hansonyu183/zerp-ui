<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VProgressLinear,
} from "vuetify/components";
import type { WorkbenchPage, WorkbenchSnapshot } from "./workbench";
import { navigationGlyph } from "./shell";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
const props = defineProps<{
  options: WorkbenchPage;
  scope: string;
  active: boolean;
}>();
const sections = [
  { key: "vouchers", title: "常用单据", empty: "暂无常用单据" },
  {
    key: "reports",
    title: "常用报表",
    empty: "暂无常用报表，可添加常用报表。",
  },
  { key: "masters", title: "常用资料", empty: "暂无常用资料" },
] as const;
const data = shallowRef<WorkbenchSnapshot>();
const expanded = ref({ vouchers: false, reports: false, masters: false });
const busy = ref(false),
  error = ref("");
let generation = 0,
  controller: AbortController | undefined;
function cancel() {
  generation++;
  controller?.abort();
}
async function load() {
  if (busy.value || !props.active) return;
  const epoch = generation;
  const request = (controller = new AbortController());
  busy.value = true;
  error.value = "";
  try {
    const result = await props.options.adapter.load({
      scope: props.scope,
      signal: request.signal,
    });
    if (epoch === generation && props.active) data.value = result;
  } catch (cause) {
    if (epoch === generation && props.active)
      error.value =
        cause instanceof Error ? cause.message : "读取失败，请重试。";
  } finally {
    if (epoch === generation) busy.value = false;
  }
}
watch(
  () => [
    props.scope,
    props.active,
    props.options.instance,
    props.options.adapter,
  ],
  () => {
    cancel();
    data.value = undefined;
    busy.value = false;
    error.value = "";
    expanded.value = { vouchers: false, reports: false, masters: false };
    void load();
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(cancel);
</script>
<template>
  <section class="zerp-workbench" aria-label="工作台内容" :aria-busy="busy">
    <div class="zerp-workbench-progress">
      <VProgressLinear :active="busy" indeterminate aria-label="正在读取" />
    </div>
    <FeedbackRegion
      ><Feedback :message="error" kind="error" persistent
        ><VBtn :disabled="busy" @click="load">重试</VBtn></Feedback
      ></FeedbackRegion
    >
    <div class="zerp-workbench-grid">
      <VCard
        v-for="section in sections"
        :key="section.key"
        tag="section"
        :aria-label="section.title"
        variant="outlined"
      >
        <VCardTitle tag="h2">{{ section.title }}</VCardTitle>
        <VCardText>
          <p v-if="data?.[section.key].description">
            {{ data[section.key].description }}
          </p>
          <ul
            v-if="data?.[section.key].items.length"
            class="zerp-workbench-links"
          >
            <li
              v-for="item in expanded[section.key]
                ? data[section.key].items
                : data[section.key].items.slice(0, 12)"
              :key="item.key"
            >
              <RouterLink :to="item.to"
                ><span
                  v-if="item.icon"
                  class="zerp-ui-icon"
                  aria-hidden="true"
                  >{{ navigationGlyph(item.icon) }}</span
                >{{ item.name }}</RouterLink
              >
            </li>
          </ul>
          <p v-else>
            {{
              busy ? "正在读取，请稍候。" : error ? "读取失败" : section.empty
            }}
          </p>
          <VBtn
            v-if="(data?.[section.key].items.length ?? 0) > 12"
            variant="text"
            :aria-expanded="expanded[section.key]"
            @click="expanded[section.key] = !expanded[section.key]"
            >{{ expanded[section.key] ? "收起" : "展开全部" }}</VBtn
          >
          <RouterLink
            v-if="section.key === 'reports' && options.manageReportsTo"
            :to="options.manageReportsTo"
            >管理常用报表</RouterLink
          >
        </VCardText>
      </VCard>
      <VCard tag="section" aria-label="重要信息" variant="outlined">
        <VCardTitle tag="h2">重要信息</VCardTitle>
        <VCardText
          ><ul v-if="data?.information.length">
            <li
              v-for="item in data.information"
              :key="item.key"
              class="zerp-workbench-information"
            >
              {{ item.text }}
            </li>
          </ul>
          <p v-else>暂无信息</p></VCardText
        >
      </VCard>
    </div>
  </section>
</template>
