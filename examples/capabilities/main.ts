import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { createRouter, createWebHistory } from "vue-router";
import { createShellThemes } from "@zerp/ui";
import "vuetify/styles";
import "@zerp/ui/style.css";
import "../shared/example.css";
import App from "./App.vue";
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/:pathMatch(.*)*", component: App }],
});
const app = createApp(App)
  .use(createVuetify({ theme: createShellThemes() }))
  .use(router);
void router.isReady().then(() => app.mount("#app"));
