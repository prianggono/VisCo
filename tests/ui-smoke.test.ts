import { test, expect } from "@playwright/test";

test("VisCo UI smoke: startup and primary controls render", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText("Preview", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Program", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Library", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Scene", { exact: true }).first()).toBeVisible();
});

test("VisCo UI smoke: no uncaught page errors on startup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  expect(errors).toEqual([]);
});
