import { effectScope, getCurrentInstance, watch, type App } from "vue";
import { createVuetify } from "vuetify";
import type { BusinessModel } from "../model/business-model";
import { createShellThemes } from "../styles/theme";

const installations = new WeakMap<App, ReturnType<typeof createVuetify>>();

export function useVuetify(brand: () => BusinessModel["brand"]) {
  const app = getCurrentInstance()!.appContext.app;
  watch(
    [() => brand().primary, () => brand().secondary],
    ([primary, secondary]) => {
      const theme = createShellThemes({ primary, secondary });
      const installed = installations.get(app);
      if (installed) {
        Object.assign(installed.theme.themes.value, theme.themes);
        return;
      }

      // Vuetify survives replacing the library component within the same Vue app.
      const scope = effectScope(true);
      scope.run(() => {
        const vuetify = createVuetify({ theme });
        app.use(vuetify);
        installations.set(app, vuetify);
      });
      app.onUnmount(() => scope.stop());
    },
    { immediate: true },
  );
}
