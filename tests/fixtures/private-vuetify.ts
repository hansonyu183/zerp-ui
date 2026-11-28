// Private widget fixtures render without the public App.
import { config } from "@vue/test-utils";
import { createVuetify } from "vuetify";

config.global.plugins = [createVuetify()];
