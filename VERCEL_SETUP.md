# Configuración de Vercel

## ⚠️ Importante: Configuración del Root Directory

El proyecto Next.js está en el subdirectorio `converzia-app/`, por lo que Vercel necesita estar configurado para usar ese directorio como raíz.

### Pasos para configurar en Vercel:

1. Ve al dashboard de Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto `Converzia`
3. Ve a **Settings** → **General**
4. En la sección **Root Directory**, configura:
   - **Root Directory**: `converzia-app`
5. Guarda los cambios

### Verificación

Después de configurar el Root Directory, el siguiente deployment debería:
- Encontrar el `package.json` en `converzia-app/package.json`
- Encontrar el `vercel.json` en `converzia-app/vercel.json`
- Ejecutar `npm install` y `npm run build` desde `converzia-app/`

## Variables de Entorno Requeridas

Asegúrate de configurar todas las variables de entorno en Vercel:

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### OpenAI
- `OPENAI_API_KEY`

### Chatwoot
- `CHATWOOT_BASE_URL`
- `CHATWOOT_API_TOKEN`
- `CHATWOOT_ACCOUNT_ID`

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Google Sheets (Opcional)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Tokko (Opcional)
- `TOKKO_API_KEY`
- `TOKKO_API_URL`

### Otros
- `NEXT_PUBLIC_APP_URL` (ej: `https://converzia.vercel.app`)
- `UPSTASH_REDIS_REST_URL` (para rate limiting)
- `UPSTASH_REDIS_REST_TOKEN` (para rate limiting)

## Build Settings

Vercel debería detectar automáticamente:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (automático)
- **Output Directory**: `.next` (automático)
- **Install Command**: `npm install` (automático)

## Cron Jobs

Los cron jobs están configurados en `converzia-app/vercel.json`:
- `/api/cron/process-deliveries` - Cada 5 minutos
- `/api/cron/retry-contacts` - Cada 2 horas
- `/api/cron/credit-alerts` - Diario a las 12:00
- `/api/cron/tokko-sync` - Cada 6 horas

## Troubleshooting

### Error: "Build failed"
1. Verifica que el Root Directory esté configurado como `converzia-app`
2. Verifica que todas las variables de entorno estén configuradas
3. Revisa los logs de build en Vercel para ver el error específico

### Error: "Module not found"
- Asegúrate de que el Root Directory esté correctamente configurado
- Verifica que `package.json` esté en `converzia-app/package.json`

### Error: "Environment variable missing"
- Revisa la lista de variables de entorno arriba
- Asegúrate de configurarlas en el entorno correcto (Production, Preview, Development)
