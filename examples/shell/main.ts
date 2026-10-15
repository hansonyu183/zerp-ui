import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { createRouter, createWebHistory } from "vue-router";
import { createShellThemes } from "@zerp/ui";
import "vuetify/styles";
import "@zerp/ui/style.css";
import App from "./App.vue";
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/:pathMatch(.*)*", component: App }],
});
createApp(App)
  .use(
    createVuetify({
      theme: createShellThemes({ primary: "#295787", secondary: "#76542c" }),
    }),
  )
  .use(router)
  .mount("#app");
