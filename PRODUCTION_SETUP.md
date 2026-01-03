# Guía de Setup para Producción - Converzia

Esta guía te ayudará a configurar Converzia completamente para producción.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración de Base de Datos](#configuración-de-base-de-datos)
3. [Variables de Entorno](#variables-de-entorno)
4. [Configuración de Servicios Externos](#configuración-de-servicios-externos)
5. [Deployment](#deployment)
6. [Verificación Post-Deployment](#verificación-post-deployment)

---

## Requisitos Previos

- Cuenta de Supabase (base de datos)
- Cuenta de Vercel (hosting)
- Cuenta de OpenAI (API key)
- Cuenta de Stripe (pagos)
- Cuenta de Upstash (Redis para rate limiting)
- (Opcional) Cuenta de Chatwoot (mensajería)
- (Opcional) Cuenta de Meta/Facebook (Lead Ads)

---

## Configuración de Base de Datos

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. Anota el **Project URL** y las **API Keys**

### 2. Aplicar Migraciones

```bash
cd converzia-core
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

O ejecuta manualmente las migraciones desde `converzia-core/migrations/` en orden.

### 3. Configurar Storage Buckets

En Supabase Dashboard → Storage:

1. Crear bucket `rag-documents` (público: false)
2. Configurar políticas RLS según `022_storage_rls_policies.sql`

---

## Variables de Entorno

### Variables Requeridas (Críticas)

#### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

**Cómo obtenerlas:**
- Ve a Supabase Dashboard → Settings → API
- Copia el Project URL y las API Keys

#### Stripe
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Cómo obtenerlas:**
1. Ve a [Stripe Dashboard](https://dashboard.stripe.com)
2. API Keys → Copia la Secret Key (modo Live)
3. Webhooks → Crea endpoint → Copia el Signing Secret

#### Meta/Facebook
```env
META_WEBHOOK_VERIFY_TOKEN=tu_token_secreto_aqui
META_APP_SECRET=tu_app_secret
META_PAGE_ACCESS_TOKEN=tu_page_access_token
```

**Cómo obtenerlas:**
1. Ve a [Meta for Developers](https://developers.facebook.com)
2. Crea una App → Facebook Login + Lead Ads
3. Webhook Verify Token: Genera uno aleatorio (ej: `openssl rand -hex 16`)
4. App Secret: En Settings → Basic
5. Page Access Token: En Tools → Graph API Explorer

#### Chatwoot
```env
CHATWOOT_WEBHOOK_SECRET=tu_webhook_secret
CHATWOOT_BASE_URL=https://app.chatwoot.com
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_API_TOKEN=tu_api_token
CHATWOOT_INBOX_ID=1
```

**Cómo obtenerlas:**
1. Ve a tu instancia de Chatwoot
2. Settings → Applications → Crea un Access Token
3. Inboxes → Selecciona el inbox → Copia el ID
4. Webhooks → Configura el webhook secret

#### Cron Protection
```env
CRON_SECRET=tu_secret_aleatorio
```

**Generar:**
```bash
openssl rand -hex 32
```

### Variables Recomendadas (Importantes)

#### Rate Limiting (Upstash Redis)
```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Cómo obtenerlas:**
1. Ve a [Upstash](https://upstash.com)
2. Crea una base de datos Redis
3. Copia la REST URL y Token

#### PII Encryption
```env
PII_ENCRYPTION_KEY=tu_clave_hex_64_caracteres
```

**Generar:**
```bash
openssl rand -hex 32
```

#### OpenAI
```env
OPENAI_API_KEY=sk-...
```

**Nota:** También se puede configurar desde Admin UI en `app_settings`

#### Google OAuth (para Google Sheets)
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
```

**Cómo obtenerlas:**
1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un proyecto o selecciona uno existente
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Tipo: Web application
5. Authorized redirect URIs: `https://tu-dominio.com/api/integrations/google/callback`
6. Copia Client ID y Client Secret

### Variables Opcionales

#### Testing
```env
TEST_SECRET=tu_secret_para_test_endpoints
```

**Generar:**
```bash
openssl rand -hex 16
```

---

## Configuración de Servicios Externos

### 1. Stripe Webhook

1. Ve a Stripe Dashboard → Webhooks
2. Add endpoint: `https://tu-dominio.com/api/webhooks/stripe`
3. Selecciona eventos:
   - `checkout.session.completed`
4. Copia el Signing Secret → `STRIPE_WEBHOOK_SECRET`

### 2. Meta Webhook

1. Ve a Meta for Developers → Tu App
2. Webhooks → Lead Ads → Subscribe
3. Callback URL: `https://tu-dominio.com/api/webhooks/meta-leads`
4. Verify Token: Usa el mismo que configuraste en `META_WEBHOOK_VERIFY_TOKEN`
5. Suscribe a eventos: `leadgen`

### 3. Chatwoot Webhook

1. Ve a Chatwoot → Settings → Applications → Webhooks
2. Add Webhook: `https://tu-dominio.com/api/webhooks/chatwoot`
3. Events: `message_created`, `message_updated`
4. Webhook Secret: Genera uno y configúralo en `CHATWOOT_WEBHOOK_SECRET`

### 4. Vercel Cron Jobs

En `vercel.json`, configura:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-deliveries",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/retry-contacts",
      "schedule": "0 */2 * * *"
    },
    {
      "path": "/api/cron/credit-alerts",
      "schedule": "0 12 * * *"
    },
    {
      "path": "/api/cron/tokko-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Nota:** Asegúrate de configurar el header `Authorization: Bearer ${CRON_SECRET}` en Vercel.

---

## Deployment

### 1. Preparar Repositorio

```bash
# Asegúrate de que todo esté commiteado
git add .
git commit -m "Ready for production"
git push
```

### 2. Deploy en Vercel

1. Ve a [Vercel](https://vercel.com)
2. Import Project → Selecciona tu repositorio
3. Root Directory: `converzia-app`
4. Framework Preset: Next.js
5. Environment Variables: Agrega todas las variables de la sección anterior
6. Deploy

### 3. Configurar Dominio

1. En Vercel → Settings → Domains
2. Agrega tu dominio personalizado
3. Configura DNS según las instrucciones

---

## Verificación Post-Deployment

### 1. Health Check

Visita: `https://tu-dominio.com/api/health`

Debería retornar:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
}
```

### 2. Verificar Webhooks

#### Stripe
- Ve a Stripe Dashboard → Webhooks
- Verifica que el endpoint esté activo y recibiendo eventos

#### Meta
- Ve a Meta for Developers → Webhooks
- Verifica que el webhook esté suscrito

#### Chatwoot
- Envía un mensaje de prueba desde Chatwoot
- Verifica que se procese correctamente

### 3. Probar Flujo Completo

1. **Registro de Tenant:**
   - Registra un nuevo tenant
   - Verifica que aparezca como PENDING

2. **Aprobación:**
   - Como admin, aprueba el tenant
   - Verifica que el usuario pueda acceder al portal

3. **Configuración de Integraciones:**
   - Configura Tokko
   - Sincroniza ofertas
   - Configura Google Sheets

4. **Flujo de Leads:**
   - Simula un lead desde Meta
   - Verifica que se procese y entregue

### 4. Verificar Logs

- Vercel → Deployments → Functions → Ver logs
- Supabase → Logs → Verificar queries
- Verificar que no haya errores críticos

---

## Troubleshooting

### Error: "Missing required environment variables"
- Verifica que todas las variables requeridas estén configuradas en Vercel
- Revisa `converzia-app/src/lib/security/env-validation.ts`

### Error: "Webhook signature validation failed"
- Verifica que los secrets de webhooks estén correctos
- Asegúrate de que el webhook esté configurado correctamente en el servicio externo

### Error: "Database connection failed"
- Verifica las credenciales de Supabase
- Verifica que el proyecto esté activo
- Revisa las políticas RLS

### Error: "Rate limiting not working"
- Verifica que Upstash Redis esté configurado
- Si no está configurado, el sistema usará rate limiting en memoria (menos robusto)

---

## Seguridad

### Checklist de Seguridad

- [ ] Todas las variables de entorno están configuradas
- [ ] `CRON_SECRET` está configurado y es único
- [ ] `PII_ENCRYPTION_KEY` está configurado
- [ ] Webhooks tienen signature validation activa
- [ ] RLS policies están aplicadas en Supabase
- [ ] Service role key solo se usa server-side
- [ ] Rate limiting está activo
- [ ] HTTPS está habilitado (Vercel lo hace automáticamente)

---

## Monitoreo

### Métricas a Monitorear

1. **Performance:**
   - Latencia de API endpoints
   - Tiempo de respuesta de webhooks
   - Tiempo de procesamiento de leads

2. **Errores:**
   - Errores de webhooks
   - Errores de integraciones
   - Errores de base de datos

3. **Negocio:**
   - Leads procesados
   - Conversaciones activas
   - Créditos consumidos
   - Pagos procesados

### Alertas Recomendadas

- Webhooks fallidos repetidamente
- Errores críticos en logs
- Créditos bajos en tenants
- Servicios externos caídos

---

## Soporte

Para problemas o preguntas:
- Email: soporte@converzia.io
- Documentación: Ver README.md y este archivo

---

## Actualizaciones

Para actualizar la aplicación:

1. Pull los últimos cambios
2. Ejecuta migraciones de DB si hay nuevas
3. Actualiza variables de entorno si es necesario
4. Deploy en Vercel
5. Verifica que todo funcione

---

**Última actualización:** 2024

