import { DOMWrapper, type VueWrapper } from "@vue/test-utils";

/** Find ordinary page controls and real Vuetify dialogs teleported outside the mount. */
export function hostAndDialogButtons(host: VueWrapper) {
  const dialogs = Array.from(
    document.querySelectorAll('[role="dialog"], [role="menu"]'),
  ).reverse();
  const overlays = dialogs.flatMap((dialog) =>
    Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
      (element) => new DOMWrapper(element),
    ),
  );
  return overlays.concat(host.findAll("button"));
}
