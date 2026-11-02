import { createApp, type Component } from "vue";
import { createVuetify } from "vuetify";
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { createShellThemes, type BrandColors } from "@zerp/ui";
import "vuetify/styles";
import "./example.css";
import "@zerp/ui/style.css";
export function mountExample(
  component: Component,
  routes: RouteRecordRaw[] = [{ path: "/:pathMatch(.*)*", component }],
  colors: BrandColors = {},
) {
  createApp(component)
    .use(createVuetify({ theme: createShellThemes(colors) }))
    .use(createRouter({ history: createWebHistory(), routes }))
    .mount("#app");
}
