import { DOMWrapper, type VueWrapper } from "@vue/test-utils";

/** Find ordinary page controls and real Vuetify dialogs teleported outside the mount. */
export function hostAndDialogButtons(host: VueWrapper) {
  return host
    .findAll("button")
    .concat(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
        (element) => new DOMWrapper(element),
      ),
    );
}
