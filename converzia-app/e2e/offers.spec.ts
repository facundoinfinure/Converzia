import { test, expect } from "@playwright/test";

/**
 * Offers Management E2E Tests
 * 
 * Tests the offer/property listing management functionality.
 */

test.describe("Offers Management", () => {
  test.describe("Offers List", () => {
    test("Offers page requires authentication", async ({ page }) => {
      await page.goto("/portal/offers");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("Offers page shows list when authenticated", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/offers");
      
      // Should show offers page content
      await expect(page.getByText(/ofertas|offers|propiedades|properties/i)).toBeVisible();
    });

    test("Create offer button is visible", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/offers");
      
      // Should have a create button
      const createButton = page.getByRole("button", { name: /crear|new|nueva|add|agregar/i });
      await expect(createButton).toBeVisible();
    });
  });

  test.describe("Offer Details", () => {
    test("Offer details page requires authentication", async ({ page }) => {
      // Try to access an offer details page
      await page.goto("/portal/offers/00000000-0000-0000-0000-000000000001");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Offer Creation", () => {
    test("Create offer form has required fields", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/offers");
      
      // Click create button
      await page.getByRole("button", { name: /crear|new|nueva|add|agregar/i }).click();
      
      // Wait for form to appear (could be modal or new page)
      await page.waitForTimeout(1000);
      
      // Should have name field
      await expect(page.getByLabel(/nombre|name|título|title/i).first()).toBeVisible();
    });
  });

  test.describe("Ad Mapping", () => {
    test("Ad mapping section is accessible", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/offers");
      
      // Look for ad mapping functionality
      await expect(page.getByText(/anuncios|ads|campañas|campaigns|mapeo|mapping/i)).toBeVisible();
    });
  });
});

test.describe("Offers API", () => {
  test("Offers endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/portal/offers");
    
    expect(response.status()).toBe(401);
  });

  test("Create offer requires authentication", async ({ request }) => {
    const response = await request.post("/api/portal/offers", {
      data: {
        name: "Test Offer",
        description: "Test description",
      },
    });
    
    expect(response.status()).toBe(401);
  });
});
