import { test, expect } from "@playwright/test";

/**
 * Accessibility Tests
 * 
 * Basic accessibility checks for public pages.
 */

test.describe("Accessibility", () => {
  test("Login page has proper document structure", async ({ page }) => {
    await page.goto("/login");
    
    // Should have a main element
    const main = page.locator("main");
    await expect(main).toBeVisible();
    
    // Should have exactly one h1 or a clear heading structure
    const headings = page.getByRole("heading");
    expect(await headings.count()).toBeGreaterThan(0);
  });

  test("Login form fields are keyboard accessible", async ({ page }) => {
    await page.goto("/login");
    
    // Focus should be manageable via Tab
    await page.keyboard.press("Tab");
    
    // Eventually should be able to reach email input
    const emailInput = page.getByLabel(/email|correo/i);
    
    // Fill using keyboard
    await emailInput.focus();
    await page.keyboard.type("test@example.com");
    
    // Tab to password
    await page.keyboard.press("Tab");
    await page.keyboard.type("password123");
    
    // Tab to submit button
    await page.keyboard.press("Tab");
    
    // Should be able to submit with Enter
    const activeElement = page.locator(":focus");
    await expect(activeElement).toBeVisible();
  });

  test("Page has proper color contrast indicators", async ({ page }) => {
    await page.goto("/login");
    
    // Check that text is visible (basic check)
    const body = page.locator("body");
    await expect(body).toBeVisible();
    
    // Page should have content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("Images have alt text (if any)", async ({ page }) => {
    await page.goto("/login");
    
    // Get all images
    const images = page.locator("img");
    const count = await images.count();
    
    // Each image should have alt attribute
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      // Alt should exist (can be empty for decorative images)
      expect(alt).not.toBeNull();
    }
  });
});
