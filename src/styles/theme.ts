import type { BusinessModel } from "../model/business-model";
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
  enterpriseName: string;
  mark: string;
}>;
export function modelBrand(brand: BusinessModel["brand"]): Brand {
  return {
    productName: brand.productName,
    enterpriseName: brand.companyName,
    mark: brand.productName.slice(0, 1),
  };
}
export const appBarHeight = 48;
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
      variant: "tonal",
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
    VAutocomplete: { ...defaults?.VAutocomplete, density: "compact" },
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
