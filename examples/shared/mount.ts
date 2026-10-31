import { createApp, type Component } from "vue";
import { createVuetify } from "vuetify";
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { createShellThemes } from "@zerp/ui";
import "vuetify/styles";
import "./example.css";
import "@zerp/ui/style.css";
export function mountExample(
  component: Component,
  routes: RouteRecordRaw[] = [{ path: "/:pathMatch(.*)*", component }],
) {
  createApp(component)
    .use(createVuetify({ theme: createShellThemes() }))
    .use(createRouter({ history: createWebHistory(), routes }))
    .mount("#app");
}
