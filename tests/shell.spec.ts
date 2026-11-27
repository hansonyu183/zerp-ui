import { expect, it } from "vitest";
import { createShellThemes, defaultThemeChoice } from "../src/index";
it("provides all six official material themes with finite brand colors and MD3 light by default", () => {
  const result = createShellThemes({
    primary: "#123456",
    secondary: "#654321",
  });
  expect(defaultThemeChoice).toEqual({ preset: "md3", mode: "light" });
  expect(result.defaultTheme).toBe("zerp-md3-light");
  expect(Object.keys(result.themes)).toHaveLength(6);
  for (const preset of ["md1", "md2", "md3"]) {
    expect(result.themes[`zerp-${preset}-dark`].dark).toBe(true);
    expect(result.themes[`zerp-${preset}-light`].dark).toBe(false);
    expect(result.themes[`zerp-${preset}-dark`].colors).toMatchObject({
      primary: "#123456",
      secondary: "#654321",
      muted: "#aeb7c5",
    });
  }
  expect(createShellThemes().themes["zerp-md3-light"].colors?.primary).not.toBe(
    "#123456",
  );
});

it("chooses readable foregrounds for light and saturated brand surfaces in every preset", () => {
  for (const primary of ["#ffff00", "#2196f3"]) {
    const themes = createShellThemes({ primary, secondary: "#000080" }).themes;
    for (const theme of Object.values(themes)) {
      expect(theme.colors?.["on-primary"]).toBe("#000000");
      expect(theme.colors?.["on-secondary"]).toBe("#ffffff");
    }
  }
});
