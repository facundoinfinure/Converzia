import { test, expect } from "@playwright/test";

/**
 * Health Check Tests
 * 
 * These tests verify that the application is running and accessible.
 */

test.describe("Health Check", () => {
  test("API health endpoint returns OK", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json.status).toBe("healthy");
    expect(json.database).toBe("connected");
  });

  test("Login page loads correctly", async ({ page }) => {
    await page.goto("/login");
    
    // Should have a login form
    await expect(page.getByRole("heading", { name: /iniciar sesión|login/i })).toBeVisible();
    
    // Should have email and password fields
    await expect(page.getByLabel(/email|correo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña|password/i)).toBeVisible();
    
    // Should have a submit button
    await expect(page.getByRole("button", { name: /ingresar|submit|entrar/i })).toBeVisible();
  });

  test("App redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin");
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("Portal redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/portal");
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
