import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  base: "./",
  plugins: [vue()],
  build: {
    assetsDir: "",
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "zerp-ui",
    },
    rolldownOptions: {
      external: (id) => /^(vue|vuetify|vue-router)(\/|$)/.test(id),
    },
  },
});
