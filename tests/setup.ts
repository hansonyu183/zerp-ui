import { config } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import { vi } from "vitest";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.matchMedia = vi.fn().mockImplementation(() => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
}));

config.global.plugins = [createVuetify()];
