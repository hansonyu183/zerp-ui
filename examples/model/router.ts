import { createRouter, createWebHistory } from "vue-router";
export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? false,
  routes: [{ path: "/:pathMatch(.*)*", component: {} }],
});
