import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  base: "./",
  plugins: [vue()],
  build: {
    assetsDir: "",
    lib: {
      entry: { index: "src/index.ts", model: "src/model.ts" },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: "zerp-ui",
    },
    rolldownOptions: {
      external: (id) => /^(vue|vuetify|vue-router)(\/|$)/.test(id),
    },
  },
});
