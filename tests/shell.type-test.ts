import {
  createShellThemes,
  type NavigationGroup,
  type ThemeChoice,
  type ShellAccount,
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
// @ts-expect-error no arbitrary account commands
const account: ShellAccount = { label: "账户", actions: ["execute"] };
void [choice, wrong, navigation, account];
