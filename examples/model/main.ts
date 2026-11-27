import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { createShellThemes } from "@zerp/ui";
import "vuetify/styles";
import "@zerp/ui/style.css";
import "../shared/example.css";
import App from "./App.vue";
createApp(App)
  .use(createVuetify({ theme: createShellThemes() }))
  .mount("#app");
