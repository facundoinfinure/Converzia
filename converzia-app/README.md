# Converzia

**Plataforma de calificación de leads inmobiliarios con WhatsApp e IA**

Converzia es una aplicación multi-tenant que automatiza la calificación de leads a través de conversaciones de WhatsApp potenciadas por IA, entregando leads calificados a desarrolladores inmobiliarios.

## 🚀 Características

### Para Administradores (Converzia)
- Dashboard de operaciones con métricas en tiempo real
- Gestión completa de tenants (alta, pricing, configuración)
- Mapeo de Facebook Lead Ads a ofertas
- Base de conocimiento para RAG
- Gestión de usuarios y aprobaciones
- Configuración de integraciones (Meta, WhatsApp, Chatwoot, OpenAI)
- Monitor de entregas y reembolsos

### Para Tenants (Desarrolladores)
- Dashboard con estadísticas de leads
- Vista de leads con detalle de calificación
- Gestión de ofertas/proyectos
- Billing y compra de créditos
- Gestión de equipo con roles

### Automatización
- Ingesta de leads desde Facebook Lead Ads
- Conversaciones automatizadas por WhatsApp
- Extracción estructurada de datos con GPT-4
- Scoring inteligente de leads
- Entrega automática a Google Sheets/CRM
- Sistema de retry y reactivación

## 📦 Stack Tecnológico

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase Edge Functions
- **Base de datos**: PostgreSQL (Supabase) con pgvector para RAG
- **Autenticación**: Supabase Auth con RBAC
- **Integraciones**: 
  - Meta Lead Ads (webhooks)
  - WhatsApp Business API (via Chatwoot)
  - OpenAI (GPT-4, embeddings)
  - Stripe (pagos)
  - Google Sheets API

## 🛠️ Instalación

### Prerrequisitos
- Node.js 18+
- Cuenta de Supabase
- Cuenta de OpenAI
- Cuenta de Stripe
- Cuenta de Meta Developer
- Instancia de Chatwoot

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-org/converzia.git
cd converzia/converzia-app
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env.local
# Editar .env.local con tus valores
```

### 4. Configurar base de datos
Ejecutar las migraciones en el directorio `converzia-core/migrations/` en orden:
```sql
-- En Supabase SQL Editor
-- Ejecutar cada archivo de migración en orden
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

## 🏗️ Estructura del Proyecto

```
converzia-app/
├── src/
│   ├── app/                    # App Router pages
│   │   ├── admin/              # Admin panel
│   │   ├── portal/             # Tenant portal
│   │   ├── api/                # API routes
│   │   └── login/              # Auth pages
│   ├── components/
│   │   ├── layout/             # Layout components
│   │   └── ui/                 # UI component library
│   ├── lib/
│   │   ├── auth/               # Auth context
│   │   ├── hooks/              # Custom hooks
│   │   ├── services/           # Business logic
│   │   ├── supabase/           # Supabase clients
│   │   ├── utils.ts            # Utilities
│   │   └── validations/        # Zod schemas
│   └── types/                  # TypeScript types
├── public/
└── package.json
```

## 🔐 Roles y Permisos

### Converzia Admin
- Acceso completo al panel de administración
- Gestión de todos los tenants
- Configuración global de integraciones

### Tenant Roles
- **OWNER**: Acceso completo al tenant
- **ADMIN**: Todo excepto eliminar tenant
- **BILLING**: Ver leads + gestionar billing
- **VIEWER**: Solo lectura de leads

## 🌐 Deploy

### Vercel (Recomendado)
1. Conectar repositorio a Vercel
2. Configurar variables de entorno
3. Deploy automático con cada push

### Docker (Opcional)
```bash
docker build -t converzia .
docker run -p 3000:3000 converzia
```

## 📝 Webhooks

### Meta Lead Ads
```
URL: https://tu-dominio.com/api/webhooks/meta-leads
Verificación: Usar token configurado en META_WEBHOOK_VERIFY_TOKEN
```

### Chatwoot
```
URL: https://tu-dominio.com/api/webhooks/chatwoot
Eventos: message_created
```

### Stripe
```
URL: https://tu-dominio.com/api/webhooks/stripe
Eventos: checkout.session.completed, payment_intent.payment_failed
```

## 🔄 Cron Jobs (Vercel)

Los siguientes jobs están configurados en `vercel.json`:

- **Retry Contacts**: Cada 15 min - Reintenta contactar leads sin respuesta
- **Process Deliveries**: Cada 5 min - Procesa entregas pendientes

## 📊 Flujo de un Lead

```
1. Lead Ad → Webhook Meta → Crear Lead
2. Mapear Ad → Asignar Tenant/Oferta
3. Iniciar conversación WhatsApp
4. Extraer campos con GPT-4
5. Scoring del lead
6. Si score >= threshold → Lead Ready
7. Verificar créditos → Entregar
8. Google Sheets / CRM
9. Consumir crédito
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck
```

## 📄 Licencia

Propiedad de Converzia. Todos los derechos reservados.



