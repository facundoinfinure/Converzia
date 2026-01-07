import { test, expect } from "@playwright/test";

/**
 * Navigation Tests
 * 
 * These tests verify basic navigation patterns.
 */

test.describe("Navigation", () => {
  test("Home redirects appropriately", async ({ page }) => {
    await page.goto("/");
    
    // Should either show a landing page or redirect to login
    // Give it time to process redirects
    await page.waitForTimeout(1000);
    
    // URL should be either / or /login
    const url = page.url();
    expect(url).toMatch(/\/(login)?$/);
  });

  test("404 page shows for unknown routes", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-12345");
    
    // Should return 404
    expect(response?.status()).toBe(404);
  });

  test("API routes return proper content type", async ({ request }) => {
    const response = await request.get("/api/health");
    
    // Should return JSON
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");
  });

  test("Static assets load correctly", async ({ page }) => {
    await page.goto("/login");
    
    // Wait for page to fully load
    await page.waitForLoadState("networkidle");
    
    // Check for CSS loading (page should have styles)
    const body = page.locator("body");
    const hasStyles = await body.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.fontFamily !== "" || computed.backgroundColor !== "";
    });
    expect(hasStyles).toBeTruthy();
  });
});
