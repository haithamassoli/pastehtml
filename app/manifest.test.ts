import { describe, expect, test } from "vitest";
import manifest from "./manifest";

// The installability contract, not a snapshot of the copy. Chrome will refuse
// to install without a name, a start URL, a standalone display and icons at
// both 192 and 512 — so those are what is asserted, and a maskable icon
// alongside them so a launcher never crops the mark badly.
describe("web app manifest", () => {
  const value = manifest();

  test("carries what a browser needs to install it", () => {
    expect(value.name).toBeTruthy();
    expect(value.short_name).toBeTruthy();
    expect(value.start_url).toBe("/");
    expect(value.display).toBe("standalone");
  });

  test("declares 192, 512 and a maskable icon", () => {
    const icons = value.icons ?? [];
    const sizes = icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  test("every icon is same-origin and absolute", () => {
    for (const icon of value.icons ?? []) expect(icon.src).toMatch(/^\//);
  });
});
