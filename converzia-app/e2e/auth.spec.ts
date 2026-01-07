import { test, expect } from "@playwright/test";

/**
 * Authentication Tests
 * 
 * These tests verify the authentication flow.
 * Note: For full login tests, you would need test credentials.
 */

test.describe("Authentication", () => {
  test("Login form validates required fields", async ({ page }) => {
    await page.goto("/login");
    
    // Try to submit empty form
    await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
    
    // Should show validation errors or not navigate away
    await expect(page).toHaveURL(/\/login/);
  });

  test("Login form shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    
    // Fill with invalid credentials
    await page.getByLabel(/email|correo/i).fill("invalid@test.com");
    await page.getByLabel(/contraseña|password/i).fill("wrongpassword");
    
    // Submit the form
    await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
    
    // Should stay on login page (or show error)
    // Wait a bit for the auth attempt
    await page.waitForTimeout(2000);
    
    // Either shows an error or stays on login page
    const url = page.url();
    expect(url).toMatch(/\/login/);
  });

  test("Login page has proper accessibility", async ({ page }) => {
    await page.goto("/login");
    
    // Check for proper form labeling
    const emailInput = page.getByLabel(/email|correo/i);
    const passwordInput = page.getByLabel(/contraseña|password/i);
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // Check password input is of type password
    await expect(passwordInput).toHaveAttribute("type", "password");
    
    // Check email input accepts email format
    await expect(emailInput).toHaveAttribute("type", "email");
  });
});
