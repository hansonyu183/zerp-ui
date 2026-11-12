<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  defineBusinessWorkbenchPage,
  defineWorkbenchPreferencesPage,
  type WorkbenchPreference,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
type Key = { kind: "report" | "ds"; id: string };
const route = useRoute();
function saved(): string[] {
  return JSON.parse(localStorage.getItem("synthetic-workbench") ?? "[]");
}
const candidates = (): WorkbenchPreference<Key>[] =>
  Array.from({ length: 52 }, (_, i) => ({
    id: "report:" + i,
    key: { kind: i === 51 ? "ds" : "report", id: String(i) },
    name: "合成报表" + i,
    added: saved().includes(String(i)),
  }));
const home = defineBusinessWorkbenchPage({
  model: {
    kind: "object",
    name: "工作台",
    properties: Object.fromEntries(
      [
        ["information", "重要信息"],
        ["vouchers", "常用单据"],
        ["reports", "常用报表"],
        ["masters", "常用资料"],
      ].map(([key, name]) => [key!, { kind: "collection", name: name! }]),
    ),
    form: { fields: ["information", "vouchers", "reports", "masters"] },
  },
  instance: "synthetic-home",
  manageReportsTo: "/preferences",
  adapter: {
    async load() {
      return {
        vouchers: {
          description: "最近100天",
          items: Array.from({ length: 13 }, (_, i) => ({
            key: String(i),
            name: "合成单据" + i,
            to: "/voucher/" + i,
            icon: "voucher" as const,
          })),
        },
        reports: {
          items: candidates()
            .filter((item) => item.added)
            .map((item) => ({
              key: item.id,
              name: item.name,
              to: "/report/" + item.key.id,
            })),
        },
        masters: { items: [] },
        information: [],
      };
    },
  },
});
const preferences = defineWorkbenchPreferencesPage<Key>({
  title: "管理常用报表",
  instance: "synthetic-preferences",
  adapter: {
    async load() {
      return candidates();
    },
    async setAdded({ key, added }) {
      const values = new Set(saved());
      if (added) values.add(key.id);
      else values.delete(key.id);
      localStorage.setItem("synthetic-workbench", JSON.stringify([...values]));
    },
  },
});
const page = computed(() =>
  route.path === "/preferences" ? preferences : home,
);
</script>
<template><ExamplePage :page="page" scope="synthetic" /></template>
