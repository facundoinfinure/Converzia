import { test, expect } from "@playwright/test";

/**
 * Billing Flow E2E Tests
 * 
 * Tests the billing and credit management functionality.
 */

test.describe("Billing Management", () => {
  test.describe("Credits Page Access", () => {
    test("Credits page requires authentication", async ({ page }) => {
      await page.goto("/portal/billing");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("Credits page shows balance when authenticated", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/billing");
      
      // Should show credits balance
      await expect(page.getByText(/créditos|credits|saldo|balance/i)).toBeVisible();
    });
  });

  test.describe("Purchase Flow", () => {
    test("Buy credits button is visible", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/billing");
      
      // Should have a buy credits button
      const buyButton = page.getByRole("button", { name: /comprar|buy|adquirir/i });
      await expect(buyButton).toBeVisible();
    });

    test("Credit packages are displayed", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/billing");
      
      // Click on buy credits
      await page.getByRole("button", { name: /comprar|buy|adquirir/i }).click();
      
      // Should show package options (prices/quantities)
      await expect(page.getByText(/USD|\$|ARS/i)).toBeVisible();
    });
  });

  test.describe("Transaction History", () => {
    test("Shows consumption history", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/billing");
      
      // Should have consumption/history section
      await expect(page.getByText(/historial|history|consumo|consumption/i)).toBeVisible();
    });
  });
});

test.describe("Billing API", () => {
  test("Credits endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/tenants/credits");
    
    expect(response.status()).toBe(401);
  });

  test("Consumption endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/portal/billing/consumption");
    
    expect(response.status()).toBe(401);
  });
});
