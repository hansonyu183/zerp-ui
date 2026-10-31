import { ref, shallowRef, type InjectionKey } from "vue";
import {
  defaultThemeChoice,
  type Brand,
  type NavigationGroup,
  type PageDefinition,
  type LoadState,
  type ThemeChoice,
  type AppPageHandle,
} from "@zerp/ui";
export function createExampleShell() {
  return {
    hosted: false,
    content: shallowRef<PageDefinition>(),
    contentScope: ref("synthetic-session"),
    contentActive: ref(true),
    contentOwner: shallowRef<symbol>(),
    host: shallowRef<AppPageHandle>(),
    brand: {
      productName: "星河演示",
      enterpriseName: "合成公司",
      home: "/",
      mark: { kind: "text", text: "星" },
    } as Brand,
    brandState: ref<LoadState>({ kind: "ready" }),
    navigation: [] as NavigationGroup[],
    navigationState: ref<LoadState>({ kind: "ready" }),
    selectedNavigationKey: ref<string | null>(),
    theme: ref<ThemeChoice>(defaultThemeChoice),
    name: ref("演示账户"),
    avatar: ref<{ src: string; alt: string }>(),
    override: shallowRef<PageDefinition>(),
    accountAction: (_action: "profile" | "change-password" | "sign-out") => {},
    saveTheme(choice: ThemeChoice) {
      this.theme.value = choice;
    },
  };
}
export type ExampleShell = ReturnType<typeof createExampleShell>;
export const exampleShellKey: InjectionKey<ExampleShell> = Symbol(
  "synthetic-example-shell",
);
