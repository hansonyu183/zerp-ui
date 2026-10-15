import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { createRouter, createWebHistory } from "vue-router";
import "vuetify/styles";
import "@zerp/ui/style.css";
import App from "./App.vue";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: App },
    { path: "/documents/:id", component: App },
  ],
});
createApp(App).use(createVuetify()).use(router).mount("#app");
