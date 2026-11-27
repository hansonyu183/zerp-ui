import { mount, flushPromises, DOMWrapper } from "@vue/test-utils";
import { App } from "../../src/index";
import type { BusinessModel, ListCollection } from "../../src/model";
export async function render(
  model: BusinessModel,
  attrs?: Record<string, unknown>,
) {
  const wrapper = mount(App, {
    props: { model },
    attrs,
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}
export async function click(label: string) {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>('button, a, [role="menuitem"]'),
  );
  const element = elements.find(
    (button) =>
      button.textContent?.trim() === label ||
      button.getAttribute("aria-label") === label,
  );
  if (!element) throw Error(`Missing button: ${label}`);
  await new DOMWrapper(element).trigger("click");
  await flushPromises();
}
export const input = (label: string) => {
  const node = Array.from(
    document.querySelectorAll<HTMLInputElement>("input,textarea"),
  ).find((node) => node.getAttribute("aria-label") === label);
  if (!node) throw Error(`Missing input: ${label}`);
  return new DOMWrapper(node);
};

export function route(collection: ListCollection | null) {
  const path = collection
    ? `/business/${encodeURIComponent(collection.key)}`
    : "/";
  window.history.pushState(
    {
      ...window.history.state,
      position: (window.history.state?.position ?? 0) + 1,
    },
    "",
    path,
  );
  window.dispatchEvent(
    new PopStateEvent("popstate", { state: window.history.state }),
  );
}
