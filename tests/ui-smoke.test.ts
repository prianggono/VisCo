import { test, expect } from "@playwright/test";

test("VisCo UI smoke: startup and primary controls render", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText("PREVIEW", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("PROGRAM", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("LIBRARY", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("PROPERTIES", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "FULLSCREEN", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "STREAM", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "RECORD", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "VIRTUAL OUT", exact: true })).toBeVisible();
});

test("VisCo UI smoke: no uncaught page errors on startup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    // The native Windows host is optional in the browser-only CI runner. Its
    // localhost probe is expected to be refused when visco-native-host.exe is
    // not running; page exceptions and all other console errors remain fatal.
    if (message.text() === "Failed to load resource: net::ERR_CONNECTION_REFUSED") return;
    errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  expect(errors).toEqual([]);
});

test("VisCo UI E2E: deck, program, group, slice, scene and output controls", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });

  // Preview and Program
  await page.getByRole("button", { name: "Layer 2", exact: true }).first().click();
  await expect(page.locator(".preview-name").first()).toContainText("Layer 2");
  await page.locator(".layer-box").first().click();
  await expect(page.locator(".program-badge").first()).toHaveText("ON AIR");
  // Program is triggered by the slot itself; there is no separate PROGRAM button.
  await expect(page.locator(".layer-program-button.active").first()).toContainText("ON AIR");

  // Add and collapse a Group around the selected layer.
  const layering = page.locator(".property-row").filter({ hasText: "Layering" }).first();
  await layering.scrollIntoViewIfNeeded();
  await layering.click();
  await page.getByRole("button", { name: "+ Group Selected Layer", exact: true }).click();
  const collapseGroup = page.getByTitle("Collapse group").first();
  await expect(collapseGroup).toBeVisible();
  await collapseGroup.click();
  await expect(page.getByTitle("Expand group").first()).toBeVisible();

  // Slice editor: create a slice and exercise mapping mode.
  const sliceProperty = page.locator(".property-row").filter({ hasText: "Slice" }).first();
  await sliceProperty.scrollIntoViewIfNeeded();
  await sliceProperty.click();
  await page.getByRole("button", { name: "Add Slice", exact: true }).click();
  const sliceSelect = page.locator(".property-content select").first();
  await expect(sliceSelect).toHaveValue("rectangle");
  await sliceSelect.selectOption("corner-pin");
  await expect(sliceSelect).toHaveValue("corner-pin");

  // Scene routing and output controls.
  await page.getByRole("button", { name: "DISPLAY 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "DISPLAY 2", exact: true })).toHaveClass(/enabled/);
  await page.getByRole("button", { name: "FULLSCREEN", exact: true }).click();
  await page.getByRole("button", { name: "STREAM", exact: true }).click();
  await page.getByRole("button", { name: "RECORD", exact: true }).click();
  await page.getByRole("button", { name: "VIRTUAL OUT", exact: true }).click();
  await page.getByTitle("Stream settings").click();
  await expect(page.getByText("STREAM SETTINGS", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "CLOSE", exact: true }).click();
});


test("VisCo UI E2E: same Deck switches Program, different Deck stays multi-active", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });

  const deck1 = page.locator(".deck-row").nth(0);
  const deck2 = page.locator(".deck-row").nth(1);

  // First slot establishes Program.
  await deck1.locator(".layer-box").nth(0).click();
  await expect(deck1.locator(".program-badge").first()).toHaveText("ON AIR");

  // Different Deck becomes ACTIVE but cannot steal Program.
  await deck2.locator(".layer-box").nth(2).click();
  await expect(deck1.locator(".program-badge").first()).toHaveText("ON AIR");
  await expect(deck2.locator(".active-slot-indicator").first()).toBeVisible();

  // Returning to the same Deck switches Program directly.
  await deck1.locator(".layer-box").nth(1).click();
  await expect(deck1.locator(".program-badge").first()).toHaveText("ON AIR");
  await expect(deck2.locator(".active-slot-indicator").first()).toBeVisible();
  await expect(deck1.locator(".layer-card").nth(0)).not.toHaveClass(/program/);
  await expect(deck1.locator(".layer-card").nth(1)).toHaveClass(/program/);
});

test("VisCo UI E2E: empty slot deactivates Deck and fallback Deck takes Program", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });

  const deck1 = page.locator(".deck-row").nth(0);
  const deck2 = page.locator(".deck-row").nth(1);

  // Deck 1 goes Program, then Deck 2 becomes independently active.
  await deck1.locator(".layer-box").nth(0).click();
  await deck2.locator(".layer-box").nth(0).click();
  await expect(deck1.locator(".program-badge").first()).toHaveText("ON AIR");
  await expect(deck2.locator(".active-slot-indicator").first()).toBeVisible();

  // Empty Layer 4 deactivates Deck 1 instead of entering Program.
  await deck1.locator(".layer-box").nth(3).click();
  await expect(deck1.locator(".program-badge").count()).toBe(0);
  await expect(deck2.locator(".program-badge").first()).toHaveText("ON AIR");
  await expect(deck1.locator(".layer-card").nth(3)).toHaveClass(/layer-empty/);
});

test("VisCo UI E2E: Composition isolation and lifecycle", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "COMPOSITION ⚙", exact: true }).click();
  const manager = page.locator(".composition-manager-modal");
  await expect(manager).toBeVisible();
  await manager.getByRole("button", { name: "+ NEW COMPOSITION", exact: true }).click();

  await expect(page.locator(".top-status-detail")).toContainText("COMP composition-");
  await expect(manager.locator(".scene-manager-row")).toHaveCount(2);
  await manager.getByRole("button", { name: "CLOSE", exact: true }).click();

  await page.getByRole("button", { name: "+ Add Deck", exact: true }).click();
  await page.getByRole("button", { name: /Visual Deck/ }).click();
  await expect(page.locator(".deck-row")).toHaveCount(1);
  await expect(page.locator(".deck-row").first()).toContainText("Deck");

  await page.getByRole("button", { name: "COMPOSITION ⚙", exact: true }).click();
  const rows = page.locator(".composition-manager-modal .scene-manager-row");
  await expect(rows).toHaveCount(2);
  await rows.first().getByRole("button", { name: "ACTIVATE", exact: true }).click();

  await expect(page.locator(".top-status-detail")).toContainText("COMP default");
  await expect(page.locator(".deck-row")).toHaveCount(2);
});