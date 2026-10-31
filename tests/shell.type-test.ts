import {
  createShellThemes,
  type NavigationGroup,
  type ThemeChoice,
  type ShellAccount,
  type AuthMode,
  type AuthSubmit,
  type AuthValues,
} from "../src/index";
createShellThemes({ primary: "#123456" });
// @ts-expect-error no arbitrary Vuetify styling
createShellThemes({ defaults: {} });
const choice: ThemeChoice = { preset: "md3", mode: "dark" };
// @ts-expect-error finite presets
const wrong: ThemeChoice = { preset: "custom", mode: "light" };
const navigation: NavigationGroup = {
  key: "a",
  caption: "导航",
  items: [{ key: "b", caption: "条目", to: { name: "home" }, icon: "home" }],
};
// @ts-expect-error resource mapping must choose finite semantic icons
navigation.items[0].icon = "mdi-custom";
const account: ShellAccount = {
  label: "账户",
  avatar: { src: "/synthetic-avatar.svg", alt: "合成头像" },
};
// @ts-expect-error account menu contents belong to the library
const customAccount: ShellAccount = { label: "账户", actions: ["profile"] };
void customAccount;
void [choice, wrong, navigation, account];
const values: AuthValues = { identifier: "a", password: "b", confirmation: "" };
const mode: AuthMode = "reset";
const submit: AuthSubmit = { mode: "recover", identifier: "a" };
const invalidSubmit: AuthSubmit = {
  mode: "reset",
  // @ts-expect-error reset cannot carry consumer verification credentials
  token: "secret",
  password: "b",
};
void [values, mode, submit, invalidSubmit];
