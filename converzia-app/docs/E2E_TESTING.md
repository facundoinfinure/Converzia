# E2E Testing Guide for Converzia

## Overview

This guide explains how to set up and run E2E (end-to-end) tests for the Converzia application using Playwright.

## Prerequisites

1. **Node.js 18+** installed
2. **Playwright browsers** installed: `npx playwright install`
3. **Test environment** configured (see below)

## Environment Setup

### Option 1: Local Supabase (Recommended for Development)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Start local Supabase:
   ```bash
   cd converzia-core
   supabase start
   ```

3. Create a `.env.local` file in `converzia-app/`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key-from-supabase-start>
   SUPABASE_SECRET_KEY=<service-role-key-from-supabase-start>
   ```

4. Create test users:
   ```bash
   cd converzia-app
   npx tsx scripts/create-test-users.ts
   ```

### Option 2: Dedicated Test Project on Supabase Cloud

1. Create a new Supabase project specifically for testing
2. Apply all migrations from `converzia-core/migrations/`
3. Configure environment variables to point to the test project
4. Create test users using the provided script

## Running E2E Tests

### Start the Dev Server

```bash
cd converzia-app
npm run dev
```

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
```

### Run in UI Mode (Debugging)

```bash
npx playwright test --ui
```

### Run with Trace (for debugging failures)

```bash
npx playwright test --trace on
```

## Test Structure

```
e2e/
├── auth.spec.ts        # Authentication flow tests
├── health.spec.ts      # Basic health and smoke tests
├── navigation.spec.ts  # Navigation and routing tests
├── accessibility.spec.ts # A11y compliance tests
├── lead-flow.spec.ts   # Lead creation and qualification
├── billing.spec.ts     # Credit purchase and consumption
└── tenant-setup.spec.ts # Tenant onboarding flow
```

## Test Data

### Test Users

The E2E tests expect these users to exist:

| Role | Email | Description |
|------|-------|-------------|
| Converzia Admin | `admin@test.local` | Platform administrator |
| Tenant Owner | `tenant@test.local` | Tenant with full access |
| Tenant Viewer | `viewer@test.local` | Tenant with view-only access |

### Test Tenant

- **Name**: Test Tenant Inc.
- **Status**: ACTIVE
- **Credits**: 1000 (initial balance)

## Writing New Tests

### Best Practices

1. **Use page objects** for complex pages
2. **Wait for elements** rather than using timeouts
3. **Clean up test data** after tests when possible
4. **Use semantic selectors** (roles, labels) over CSS selectors

### Example Test

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    // Common setup - login, navigate to page
    await page.goto("/login");
    await page.getByLabel("Email").fill("tenant@test.local");
    await page.getByLabel("Contraseña").fill("password123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL("/portal");
  });

  test("should do something specific", async ({ page }) => {
    // Test steps
    await page.getByRole("link", { name: "Leads" }).click();
    
    // Assertions
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  });
});
```

## CI/CD Integration

For running E2E tests in CI:

1. Set `CI=true` environment variable
2. Ensure all required env vars are set as secrets
3. Tests will run with 2 retries and generate HTML report

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    CI: true
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    SUPABASE_SECRET_KEY: ${{ secrets.TEST_SUPABASE_SECRET }}
```

## Troubleshooting

### Tests Failing with Auth Errors

1. Ensure test users exist in the database
2. Check that passwords match expected values
3. Verify Supabase URL is accessible

### Timeout Errors

1. Increase timeout in `playwright.config.ts`
2. Ensure dev server is running
3. Check network connectivity

### Element Not Found

1. Use Playwright Inspector: `npx playwright test --debug`
2. Take screenshots: `await page.screenshot({ path: 'debug.png' })`
3. Check for dynamic content loading
