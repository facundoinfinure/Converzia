# Guía de Desarrollo - Converzia

Esta guía contiene las mejores prácticas y convenciones para desarrollar en el proyecto Converzia.

## 📋 Tabla de Contenidos

- [Uso de Imágenes](#uso-de-imágenes)
- [React Hooks](#react-hooks)
- [Patrones de Imports](#patrones-de-imports)
- [Workflow de Pre-commit](#workflow-de-pre-commit)
- [Configuración del IDE](#configuración-del-ide)

## 🖼️ Uso de Imágenes

### Siempre usar Next.js `<Image />` para:

- Imágenes estáticas en `/public`
- Imágenes desde patrones remotos configurados (Supabase storage)
- Cualquier imagen que pueda ser optimizada

**Ejemplo:**
```tsx
import Image from "next/image";

<Image
  src={offer.image_url}
  alt={offer.name}
  width={400}
  height={300}
  className="rounded-lg"
/>
```

### Usar `<img>` solo cuando:

- URLs externas no en `remotePatterns` (agregar comentario ESLint disable con explicación)
- Contenido generado por usuarios que no puede ser optimizado
- Escenarios de fallback en manejadores de error

**Ejemplo:**
```tsx
// eslint-disable-next-line @next/next/no-img-element
// Fallback para URLs externas no configuradas en remotePatterns
<img src={externalUrl} alt="External content" />
```

## ⚛️ React Hooks

### Mejores Prácticas

1. **Siempre incluir todas las dependencias** en los arrays de dependencias
2. **Usar `useCallback`** para funciones pasadas a `useEffect`
3. **Usar `useMemo`** para cálculos costosos
4. **Si una dependencia se omite intencionalmente**, agregar un comentario ESLint disable con explicación

### Ejemplo Correcto:

```tsx
const loadData = useCallback(async () => {
  // ... código
}, [id, supabase, toast]);

useEffect(() => {
  loadData();
}, [loadData]);
```

### Ejemplo con Dependencia Omitida (con explicación):

```tsx
useEffect(() => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // fetchData no necesita estar en deps porque solo se ejecuta una vez al montar
  fetchData();
}, []); // Solo montaje
```

## 📦 Patrones de Imports

### Orden de Imports

1. **Paquetes externos** (React, Next.js, librerías)
2. **Módulos internos** (@/components, @/lib)
3. **Imports relativos** (./component, ../utils)

### Ejemplo:

```tsx
// 1. Paquetes externos
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Package, Users } from "lucide-react";

// 2. Módulos internos
import { PageContainer } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth/context";

// 3. Imports relativos
import { formatCurrency } from "./utils";
```

### Imports de Iconos

- **Siempre usar imports nombrados** de `lucide-react`
- **Importar todos los iconos usados** en el componente

```tsx
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Info, // ← No olvidar importar todos los iconos usados
} from "lucide-react";
```

## 🔄 Workflow de Pre-commit

### Antes de Hacer Commit

1. **Ejecutar linting estricto:**
   ```bash
   npm run lint:strict
   ```

2. **Verificar tipos de TypeScript:**
   ```bash
   npm run typecheck
   ```

3. **Corregir todos los warnings/errores** antes de hacer push

### El Hook Pre-commit

El hook de Husky ejecuta automáticamente:
- `npm run lint -- --max-warnings=0` - Falla si hay warnings
- `npm run typecheck` - Falla si hay errores de tipos

**No podrás hacer commit** si hay errores de linting o TypeScript.

## 🛠️ Configuración del IDE

### VS Code (Recomendado)

Crea o actualiza `.vscode/settings.json`:

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Extensiones Recomendadas

- **ESLint** - Validación en tiempo real
- **TypeScript and JavaScript Language Features** - Soporte TypeScript
- **Prettier** (opcional) - Formateo automático

## 🚀 Scripts Disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción (ejecuta `prebuild` automáticamente)
- `npm run lint` - Linting estándar
- `npm run lint:strict` - Linting estricto (0 warnings permitidos)
- `npm run typecheck` - Verificación de tipos TypeScript
- `npm run ci` - Ejecuta lint, typecheck y tests (para CI/CD)

## ⚠️ Reglas Críticas

Las siguientes reglas están configuradas como **errores** (no warnings) y fallarán el build:

- `react-hooks/exhaustive-deps` - Dependencias faltantes en hooks
- `@next/next/no-img-element` - Uso de `<img>` en lugar de `<Image />`
- `react/jsx-no-undef` - Componentes/iconos no importados

## 📝 Notas Adicionales

- El build en Vercel ejecuta automáticamente `prebuild`, que incluye linting estricto
- Todos los errores de ESLint fallarán el build en producción
- Siempre ejecuta `npm run lint:strict` localmente antes de hacer push
