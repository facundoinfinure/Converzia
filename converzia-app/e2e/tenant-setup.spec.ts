import { test, expect } from "@playwright/test";

/**
 * Tenant Setup and Onboarding E2E Tests
 * 
 * Tests the tenant registration and initial setup flow.
 */

test.describe("Tenant Onboarding", () => {
  test.describe("Registration Page", () => {
    test("Registration page is accessible", async ({ page }) => {
      await page.goto("/register");
      
      // Should show registration form
      await expect(page.getByRole("heading", { name: /registr|sign up|crear cuenta/i })).toBeVisible();
    });

    test("Registration form has required fields", async ({ page }) => {
      await page.goto("/register");
      
      // Check for required form fields
      await expect(page.getByLabel(/email|correo/i)).toBeVisible();
      await expect(page.getByLabel(/contraseña|password/i)).toBeVisible();
      await expect(page.getByLabel(/nombre|name/i).first()).toBeVisible();
    });

    test("Registration form validates input", async ({ page }) => {
      await page.goto("/register");
      
      // Try to submit with invalid email
      await page.getByLabel(/email|correo/i).fill("invalid-email");
      await page.getByLabel(/contraseña|password/i).fill("short");
      
      // Submit button should be present
      const submitButton = page.getByRole("button", { name: /registr|sign up|crear/i });
      await expect(submitButton).toBeVisible();
      
      // Click and check for validation
      await submitButton.click();
      
      // Should show validation errors or stay on page
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe("Tenant Configuration", () => {
    test("Settings page requires authentication", async ({ page }) => {
      await page.goto("/portal/settings");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("Settings page shows tenant configuration", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/settings");
      
      // Should show settings sections
      await expect(page.getByText(/configuración|settings|cuenta|account/i)).toBeVisible();
    });
  });

  test.describe("Integration Setup", () => {
    test("Integrations page requires authentication", async ({ page }) => {
      await page.goto("/portal/integrations");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("Integrations page shows available integrations", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/integrations");
      
      // Should show integration options
      await expect(page.getByText(/meta|facebook|whatsapp|google|chatwoot/i)).toBeVisible();
    });
  });
});

test.describe("Tenant Registration API", () => {
  test("Registration endpoint accepts POST requests", async ({ request }) => {
    // Test that the endpoint exists and responds appropriately
    const response = await request.post("/api/auth/register", {
      data: {
        email: "test-invalid@test.test",
        password: "testpassword123",
        name: "Test User",
        company: "Test Company",
      },
    });
    
    // Should return some response (could be validation error, but not 404)
    expect(response.status()).not.toBe(404);
  });
});
