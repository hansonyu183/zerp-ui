import { mount, flushPromises, DOMWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { BusinessApplication } from "../../src/index";
import type { BusinessModel } from "../../src/model";
export async function render(model: BusinessModel) {
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
    global: {
      plugins: [
        createRouter({
          history: createMemoryHistory(),
          routes: [
            { path: "/:pathMatch(.*)*", component: { template: "<div />" } },
          ],
        }),
      ],
    },
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
