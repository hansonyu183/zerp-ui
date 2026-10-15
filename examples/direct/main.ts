import { createApp } from "vue";
import { createVuetify } from "vuetify";
import "vuetify/styles";
import "@zerp/ui/style.css";
import App from "./App.vue";
createApp(App).use(createVuetify()).mount("#app");
