import type { RouteLocationRaw } from "vue-router";
import type { ThemeDefinition } from "vuetify";
import { md1, md2, md3 } from "vuetify/blueprints";
export type ThemeChoice = Readonly<{
  preset: "md1" | "md2" | "md3";
  mode: "light" | "dark";
}>;
export type BrandColors = Readonly<{ primary?: string; secondary?: string }>;
export type Brand = Readonly<{
  productName: string;
  enterpriseName: string;
  mark:
    | { kind: "text"; text: string }
    | { kind: "image"; src: string; alt: string };
}>;
export type LoadState =
  { kind: "loading" } | { kind: "ready" } | { kind: "error"; caption: string };
export type AccountIntent = "profile" | "change-password" | "sign-out";
export type ShellAccount = Readonly<{
  label: string;
  actions: readonly AccountIntent[];
}>;
export type NavigationIcon =
  "home" | "catalog" | "settings" | "report" | "voucher" | "workflow";
export type NavigationGroup = Readonly<{
  key: string;
  caption: string;
  items: readonly Readonly<{
    key: string;
    caption: string;
    to: RouteLocationRaw;
    icon?: NavigationIcon;
  }>[];
}>;
export const defaultThemeChoice: ThemeChoice = Object.freeze({
  preset: "md3",
  mode: "light",
});
const blueprints = { md1, md2, md3 };
export function shellDefaults(choice: ThemeChoice) {
  return blueprints[choice.preset].defaults;
}
export function shellThemeName(choice: ThemeChoice) {
  return `zerp-${choice.preset}-${choice.mode}`;
}
/** Pass to the host's sole createVuetify({ theme: createShellThemes() }). */
export function createShellThemes(colors: BrandColors = {}) {
  const themes: Record<string, ThemeDefinition> = {};
  for (const preset of ["md1", "md2", "md3"] as const) {
    for (const mode of ["light", "dark"] as const) {
      const official = (blueprints[preset].theme || undefined)?.themes?.[mode];
      themes[shellThemeName({ preset, mode })] = {
        ...official,
        dark: mode === "dark",
        colors: {
          ...official?.colors,
          muted: mode === "dark" ? "#aeb7c5" : "#667085",
          ...(colors.primary ? { primary: colors.primary } : {}),
          ...(colors.secondary ? { secondary: colors.secondary } : {}),
        },
      };
    }
  }
  return { defaultTheme: shellThemeName(defaultThemeChoice), themes };
}
export const navigationIcons: Record<NavigationIcon, string> = {
  home: "\u{F02DC}",
  catalog: "\u{F0219}",
  settings: "\u{F0493}",
  report: "\u{F0128}",
  voucher: "\u{F0214}",
  workflow: "\u{F0625}",
};

export function navigationGlyph(icon: NavigationIcon) {
  if (!Object.hasOwn(navigationIcons, icon))
    throw new Error(`未知导航图标：${icon}`);
  return navigationIcons[icon];
}
