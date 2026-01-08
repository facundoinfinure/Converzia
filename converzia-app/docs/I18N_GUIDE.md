# Internationalization Guide

## Overview

This guide describes how to add multi-language support to Converzia using `next-intl`.

## Installation

```bash
npm install next-intl
```

## Setup

### 1. Create Messages Directory

```
converzia-app/
├── messages/
│   ├── es.json    # Spanish (default)
│   ├── en.json    # English
│   └── pt.json    # Portuguese
```

### 2. Example Message Files

**messages/es.json** (current Spanish text):
```json
{
  "common": {
    "loading": "Cargando...",
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "search": "Buscar",
    "filters": "Filtros",
    "noResults": "No se encontraron resultados"
  },
  "auth": {
    "login": "Iniciar sesión",
    "logout": "Cerrar sesión",
    "email": "Correo electrónico",
    "password": "Contraseña",
    "forgotPassword": "¿Olvidaste tu contraseña?"
  },
  "leads": {
    "title": "Leads",
    "received": "Recibidos",
    "inChat": "En Chat",
    "qualified": "Calificados",
    "delivered": "Entregados",
    "notQualified": "No Calificados"
  },
  "billing": {
    "credits": "Créditos",
    "balance": "Saldo actual",
    "purchase": "Comprar créditos",
    "consumption": "Consumo"
  }
}
```

**messages/en.json** (English translation):
```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "filters": "Filters",
    "noResults": "No results found"
  },
  "auth": {
    "login": "Log in",
    "logout": "Log out",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot password?"
  },
  "leads": {
    "title": "Leads",
    "received": "Received",
    "inChat": "In Chat",
    "qualified": "Qualified",
    "delivered": "Delivered",
    "notQualified": "Not Qualified"
  },
  "billing": {
    "credits": "Credits",
    "balance": "Current Balance",
    "purchase": "Buy Credits",
    "consumption": "Consumption"
  }
}
```

### 3. Configuration

Create `i18n.ts` in the project root:

```typescript
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

export const locales = ["es", "en", "pt"] as const;
export const defaultLocale = "es" as const;

export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

### 4. Middleware Configuration

Update `middleware.ts`:

```typescript
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // Only show locale prefix for non-default
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

### 5. Usage in Components

```tsx
import { useTranslations } from "next-intl";

export function LeadsPage() {
  const t = useTranslations("leads");

  return (
    <div>
      <h1>{t("title")}</h1>
      <div>{t("received")}</div>
    </div>
  );
}
```

### 6. Server Components

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("common");

  return <button>{t("save")}</button>;
}
```

## Migration Strategy

### Phase 1: Setup (1 hour)
1. Install next-intl
2. Create i18n.ts and messages/es.json
3. Update middleware.ts
4. Wrap root layout with NextIntlProvider

### Phase 2: Extract Texts (2-3 hours)
1. Identify all hardcoded Spanish text
2. Create message keys
3. Replace hardcoded text with t() calls

### Phase 3: Translate (1-2 hours per language)
1. Create en.json with English translations
2. Create pt.json with Portuguese translations
3. Add language switcher UI

### Phase 4: Testing
1. Test all pages in each language
2. Verify date/number formatting
3. Check RTL support if needed

## Best Practices

1. **Key Naming**: Use nested keys like `leads.status.qualified`
2. **Pluralization**: Use ICU message format for plurals
3. **Interpolation**: Use `{variable}` syntax for dynamic values
4. **Rich Text**: Support HTML in messages when needed

## Date & Number Formatting

```tsx
import { useFormatter } from "next-intl";

function MyComponent() {
  const format = useFormatter();
  
  const date = format.dateTime(new Date(), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const price = format.number(1234.56, {
    style: "currency",
    currency: "USD",
  });
}
```

## Current Hardcoded Text Locations

Files with significant Spanish text to extract:

1. `src/app/login/page.tsx` - Login form
2. `src/app/portal/leads/page.tsx` - Leads management
3. `src/app/portal/billing/page.tsx` - Billing page
4. `src/app/admin/*/page.tsx` - Admin pages
5. `src/components/ui/*.tsx` - UI components
6. `src/lib/constants/tenant-funnel.ts` - Funnel labels
