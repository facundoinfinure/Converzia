import { test, expect } from "@playwright/test";

/**
 * Admin Panel E2E Tests
 * 
 * Tests the Converzia admin functionality.
 */

test.describe("Admin Panel", () => {
  test.describe("Admin Access Control", () => {
    test("Admin dashboard requires authentication", async ({ page }) => {
      await page.goto("/admin");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("Admin page accessible by admin users", async ({ page }) => {
      test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_ADMIN_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      // Wait for redirect to admin
      await page.waitForURL(/\/admin/, { timeout: 10000 });
      
      // Should show admin dashboard
      await expect(page.getByText(/dashboard|panel|tenants/i)).toBeVisible();
    });

    test("Regular tenant cannot access admin", async ({ page }) => {
      test.skip(!process.env.E2E_TENANT_EMAIL, "E2E_TENANT_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_TENANT_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_TENANT_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/portal/, { timeout: 10000 });
      
      // Try to access admin
      await page.goto("/admin");
      
      // Should either redirect or show access denied
      const url = page.url();
      expect(url).not.toMatch(/\/admin\/tenants/);
    });
  });

  test.describe("Tenant Management", () => {
    test("Tenants list requires admin access", async ({ page }) => {
      await page.goto("/admin/tenants");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("Admin can view tenant list", async ({ page }) => {
      test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not configured");
      
      await page.goto("/login");
      await page.getByLabel(/email|correo/i).fill(process.env.E2E_ADMIN_EMAIL!);
      await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: /ingresar|submit|entrar/i }).click();
      
      await page.waitForURL(/\/admin/, { timeout: 10000 });
      await page.goto("/admin/tenants");
      
      // Should show tenants table or list
      await expect(page.getByRole("table").or(page.getByRole("list"))).toBeVisible();
    });
  });

  test.describe("Revenue Dashboard", () => {
    test("Revenue page requires admin access", async ({ page }) => {
      await page.goto("/admin/revenue");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Pending Approvals", () => {
    test("Approvals page requires admin access", async ({ page }) => {
      await page.goto("/admin/approvals");
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});

test.describe("Admin API Endpoints", () => {
  test("Revenue API requires authentication", async ({ request }) => {
    const response = await request.get("/api/admin/revenue");
    
    expect(response.status()).toBe(401);
  });

  test("Tenants API requires authentication", async ({ request }) => {
    const response = await request.get("/api/admin/tenants");
    
    expect(response.status()).toBe(401);
  });

  test("Approvals API requires authentication", async ({ request }) => {
    const response = await request.get("/api/admin/pending-approvals");
    
    expect(response.status()).toBe(401);
  });
});
