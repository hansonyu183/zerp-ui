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

vi.stubGlobal(
  "visualViewport",
  Object.assign(new EventTarget(), {
    width: 1024,
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
  }),
);
