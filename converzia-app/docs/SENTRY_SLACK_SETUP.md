# Configuración de Alertas de Sentry en Slack

Este documento describe cómo configurar alertas de Sentry para que se notifiquen en Slack cuando ocurran errores críticos.

## Requisitos Previos

- Acceso al dashboard de Sentry (proyecto configurado)
- Acceso a un workspace de Slack con permisos para crear webhooks/integraciones
- Webhook URL de Slack para recibir notificaciones

## Pasos de Configuración

### 1. Crear Webhook de Slack

1. Ve a tu workspace de Slack: https://your-workspace.slack.com/apps
2. Busca "Incoming Webhooks" o ve directamente a: https://api.slack.com/apps
3. Crea una nueva app o usa una existente
4. Ve a "Incoming Webhooks" → Activa "Activate Incoming Webhooks"
5. Click "Add New Webhook to Workspace"
6. Selecciona el canal donde quieres recibir alertas (ej: `#alerts`, `#errors`, `#engineering`)
7. Copia la URL del webhook (formato: `https://hooks.slack.com/services/TXXXXX/BXXXXX/secret-token`)

### 2. Configurar Integración en Sentry

1. Ve al dashboard de Sentry: https://sentry.io/settings/[ORGANIZATION]/integrations/
2. Busca "Slack" en la lista de integraciones disponibles
3. Click "Add Integration" o "Configure"
4. Selecciona el workspace de Slack donde quieres recibir alertas
5. Autoriza la integración de Sentry con Slack
6. Selecciona el canal donde quieres recibir las notificaciones

### 3. Configurar Reglas de Alertas

1. Ve a: https://sentry.io/settings/[ORGANIZATION]/projects/[PROJECT]/alerts/rules/
2. Click "Create Alert Rule"

#### Regla 1: Errores Críticos (P0)

- **Nombre**: "Critical Errors - Immediate Alert"
- **Condición**: 
  - When an issue is created and the level is `fatal` or `error`
  - AND tags include `error_code: INTERNAL_ERROR` or `error_code: DATABASE_ERROR`
  - OR tag `errorBoundary: true`
- **Acciones**: 
  - Send a Slack notification to `#alerts`
  - Message: "🚨 Critical error detected: {issue.title}"
  - Include: Issue details, stack trace, user context, tenant context

#### Regla 2: Rate Limiting

- **Nombre**: "Rate Limiting Issues"
- **Condición**:
  - When an issue is created and tags include `error_code: RATE_LIMIT_EXCEEDED`
- **Acciones**:
  - Send a Slack notification to `#alerts`
  - Message: "⚠️ Rate limit exceeded: {issue.title}"

#### Regla 3: Timeouts

- **Nombre**: "Timeout Errors"
- **Condición**:
  - When an issue is created and tags include `error_code: TIMEOUT`
- **Acciones**:
  - Send a Slack notification to `#alerts`
  - Message: "⏱️ Request timeout: {issue.title}"

#### Regla 4: Errores por Tenant (Alertas de Negocio)

- **Nombre**: "High Error Rate per Tenant"
- **Condición**:
  - When the number of events in the last 1 hour is greater than 50
  - AND tag `tenant_id` is set
- **Acciones**:
  - Send a Slack notification to `#engineering`
  - Message: "📊 High error rate for tenant {tags.tenant_id}: {count} errors in last hour"

### 4. Configurar Filtros y Tags

Asegúrate de que los siguientes tags estén siendo enviados en los errores (ya implementado en `src/lib/utils/sentry.ts`):

- `error_code`: Código del error (INTERNAL_ERROR, TIMEOUT, etc.)
- `tenant_id`: ID del tenant afectado
- `request_id`: ID único de la request
- `errorBoundary`: `true` si el error fue capturado por un ErrorBoundary

### 5. Variables de Entorno (Opcional)

Si prefieres usar webhooks directos en lugar de la integración oficial:

```bash
# .env.local o Vercel Environment Variables
SENTRY_SLACK_WEBHOOK_URL=your-webhook-url-here
SENTRY_ALERT_CHANNEL=#alerts
```

### 6. Verificar Funcionamiento

1. Genera un error de test en desarrollo:
   ```typescript
   // En cualquier endpoint de prueba
   throw new Error("Test error for Sentry Slack integration");
   ```

2. Verifica que el error aparece en Sentry
3. Verifica que la notificación llega al canal de Slack configurado

## Notas

- Las alertas solo se envían en **producción** (configurado en `src/lib/utils/api-error-handler.ts`)
- En desarrollo, los errores solo se loguean localmente (a menos que `SENTRY_DEV=true`)
- Considera configurar diferentes canales para diferentes niveles de severidad
- Las alertas de rate limiting y timeouts no se envían a Sentry por defecto (configurado en `handleRateLimit` y `handleTimeout`)

## Troubleshooting

- **No recibo alertas**: Verifica que la integración de Slack esté activa y autorizada
- **Alertas duplicadas**: Revisa que no tengas múltiples reglas configuradas para el mismo tipo de error
- **Formato incorrecto**: Ajusta el formato del mensaje en la configuración de la regla de Sentry
