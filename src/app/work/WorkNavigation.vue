<script setup lang="ts">
// 呈现 WorkPage 提供的分组与链接，把普通点击交还给 WorkPage。
import { computed } from "vue";
import { plainClick } from "../../components/links";
import { navigationSections } from "./navigation";
import { navigationGlyph, type NavigationGroup } from "./navigation";
const props = defineProps<{
  navigation: readonly NavigationGroup[];
  selectedNavigationKey: string | null;
}>();
const emit = defineEmits<{ navigate: [key: string] }>();
const navigationGroups = computed(() =>
  props.navigation.map((group) => ({
    group,
    sections: navigationSections(group),
  })),
);
function select(event: MouseEvent, key: string) {
  if (!plainClick(event)) return;
  event.preventDefault();
  emit("navigate", key);
}
</script>

<template>
  <nav aria-label="主导航">
    <component
      :is="group.ungrouped ? 'div' : 'details'"
      v-for="{ group, sections } in navigationGroups"
      :key="group.key"
    >
      <summary v-if="!group.ungrouped">{{ group.caption }}</summary>
      <component
        :is="section.caption ? 'details' : 'div'"
        v-for="(section, index) in sections"
        :key="section.key ?? index"
        :class="{ 'zerp-navigation-section': section.caption }"
      >
        <summary v-if="section.caption">
          {{ section.caption }}
        </summary>
        <a
          v-for="item in section.items"
          :key="item.key"
          :href="item.href"
          :aria-current="
            selectedNavigationKey === item.key ? 'page' : undefined
          "
          @click="select($event, item.key)"
          ><span v-if="item.icon" aria-hidden="true" class="zerp-ui-icon">{{
            navigationGlyph(item.icon)
          }}</span
          >{{ item.caption }}</a
        >
      </component>
    </component>
  </nav>
</template>
