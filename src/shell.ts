import type { RouteLocationRaw } from "vue-router";
import type { ThemeDefinition } from "vuetify";
import { md1, md2, md3 } from "vuetify/blueprints";
import { getContrast } from "vuetify/lib/util/colorUtils.js";
export type ThemeChoice = Readonly<{
  preset: "md1" | "md2" | "md3";
  mode: "light" | "dark";
}>;
export type BrandColors = Readonly<{ primary?: string; secondary?: string }>;
export type Brand = Readonly<{
  productName: string;
  home: RouteLocationRaw;
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
  captions?: Readonly<Partial<Record<AccountIntent, string>>>;
  avatar?: Readonly<{ src: string; alt: string }>;
}>;
export type NavigationIcon =
  "home" | "catalog" | "settings" | "report" | "voucher" | "workflow";
export type NavigationGroup = Readonly<{
  key: string;
  caption: string;
  ungrouped?: boolean;
  items: readonly Readonly<{
    key: string;
    caption: string;
    to: RouteLocationRaw;
    icon?: NavigationIcon;
    section?: Readonly<{ key: string; caption: string }>;
  }>[];
}>;
export const defaultThemeChoice: ThemeChoice = Object.freeze({
  preset: "md3",
  mode: "light",
});
const blueprints = { md1, md2, md3 };
export function shellDefaults(choice: ThemeChoice) {
  const defaults = blueprints[choice.preset].defaults;
  return {
    ...defaults,
    VBtn: {
      ...defaults?.VBtn,
      color: "",
      density: "compact",
      minHeight: "var(--zerp-control-size)",
      minWidth: "var(--zerp-control-size)",
    },
    VList: { ...defaults?.VList, density: "compact" },
    VListItem: {
      ...defaults?.VListItem,
      density: "compact",
      minHeight: "var(--zerp-control-size)",
    },
    VTextField: { ...defaults?.VTextField, density: "compact" },
    VSelect: { ...defaults?.VSelect, density: "compact" },
    VTextarea: { ...defaults?.VTextarea, density: "compact" },
    VFileInput: { ...defaults?.VFileInput, density: "compact" },
    VCheckbox: {
      ...defaults?.VCheckbox,
      color: "on-surface",
      density: "compact",
    },
    VCheckboxBtn: {
      color: "on-surface",
      density: "compact",
      minHeight: "var(--zerp-control-size)",
      minWidth: "var(--zerp-control-size)",
    },
  };
}
export function shellThemeName(choice: ThemeChoice) {
  return `zerp-${choice.preset}-${choice.mode}`;
}
function foreground(color: Parameters<typeof getContrast>[0]) {
  return getContrast(color, "#000000") >= getContrast(color, "#ffffff")
    ? "#000000"
    : "#ffffff";
}
/** Pass to the host's sole createVuetify({ theme: createShellThemes() }). */
export function createShellThemes(colors: BrandColors = {}) {
  const themes: Record<string, ThemeDefinition> = {};
  for (const preset of ["md1", "md2", "md3"] as const) {
    for (const mode of ["light", "dark"] as const) {
      const official = (blueprints[preset].theme || undefined)?.themes?.[mode];
      const primary =
        colors.primary ??
        (typeof official?.colors?.primary === "string"
          ? official.colors.primary
          : mode === "dark"
            ? "#2196F3"
            : "#1867C0");
      const secondary =
        colors.secondary ??
        (typeof official?.colors?.secondary === "string"
          ? official.colors.secondary
          : mode === "dark"
            ? "#54B6B2"
            : "#48A9A6");
      // Error text also appears on elevated cards, and destructive confirms use a filled button.
      const error =
        mode === "dark"
          ? "#F5A6A6"
          : typeof official?.colors?.error === "string"
            ? official.colors.error
            : "#B00020";
      themes[shellThemeName({ preset, mode })] = {
        ...official,
        dark: mode === "dark",
        colors: {
          ...official?.colors,
          muted: mode === "dark" ? "#aeb7c5" : "#667085",
          "on-primary": foreground(primary),
          "on-secondary": foreground(secondary),
          error,
          "on-error": foreground(error),
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

/** Business-owned destinations presented inside the current page. */
export type PageNavigationGroup = {
  key: string;
  caption: string;
  kind: "tabs" | "menu";
  selectedKey?: string | null;
  items: NavigationGroup["items"];
};
export type RecordLink = { key: string; label: string; href: string };
