import { test, expect } from "@playwright/test";

/**
 * Funnel Analytics E2E Tests
 * 
 * Tests the funnel visualization and analytics functionality.
 */

test.describe("Funnel Analytics", () => {
  test.describe("Funnel Dashboard", () => {
    test("Funnel page requires authentication", async ({ page }) => {
      await page.goto("/portal/funnel");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("Funnel page shows stages when authenticated", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/funnel");
      
      // Should show funnel stages
      await expect(page.getByText(/embudo|funnel|conversión|conversion/i)).toBeVisible();
    });

    test("Funnel shows conversion rates", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/funnel");
      
      // Should show percentage or rate indicators
      await expect(page.getByText(/%|tasa|rate/i)).toBeVisible();
    });
  });

  test.describe("Funnel Insights", () => {
    test("Insights section shows disqualification reasons", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/funnel");
      
      // Look for insights or disqualification section
      await expect(page.getByText(/insights|razones|reasons|descalificados|disqualified/i)).toBeVisible();
    });
  });

  test.describe("Date Filtering", () => {
    test("Date range selector is available", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      await page.goto("/portal/funnel");
      
      // Look for date range controls
      await expect(
        page.getByRole("button", { name: /fecha|date|período|period|7d|30d|90d/i })
          .or(page.getByLabel(/fecha|date/i))
      ).toBeVisible();
    });
  });
});

test.describe("Funnel API", () => {
  test("Funnel stats endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/portal/funnel");
    
    expect(response.status()).toBe(401);
  });

  test("Funnel insights endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/portal/funnel/insights");
    
    expect(response.status()).toBe(401);
  });
});

test.describe("Lead Flow Visualization", () => {
  test("Lead flow can be understood from funnel", async ({ page }) => {
    test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
    
    await page.goto("/login");
    await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
    await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
    await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
    
    await page.waitForURL(/\/portal/, { timeout: 10000 });
    await page.goto("/portal/funnel");
    
    // Check for stage labels that represent the flow
    const stages = [
      /recibidos|received|nuevos|new/i,
      /chat|conversación|conversation/i,
      /calificados|qualified/i,
      /entregados|delivered/i,
    ];
    
    for (const stage of stages) {
      await expect(page.getByText(stage).first()).toBeVisible();
    }
  });
});
