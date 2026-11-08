import { config } from "@vue/test-utils";
import { vi } from "vitest";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
// jsdom has no layout/animation engine. Use Vuetify's supported reduced-motion
// preference so VField label animations do not recursively resolve inherited
// colors on deep synthetic forms. Real browser consumers keep normal motion.
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === "(prefers-reduced-motion: reduce)",
  media: query,
  addEventListener() {},
  removeEventListener() {},
}));

// Vuetify snapshots matchMedia support on import. Install the browser preference first.
const { createVuetify } = await import("vuetify");
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
