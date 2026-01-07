# Runbooks de Operaciones - Converzia

Esta guía contiene procedimientos operativos para troubleshooting, deployment y respuesta a incidentes.

## Índice

1. [Deployment](#deployment)
2. [Troubleshooting](#troubleshooting)
3. [Respuesta a Incidentes](#respuesta-a-incidentes)
4. [Mantenimiento](#mantenimiento)

---

## Deployment

### Proceso de Deployment en Vercel

1. **Pre-deployment Checklist**
   - [ ] Todos los tests pasan (`npm run test`)
   - [ ] Typecheck sin errores (`npm run typecheck`)
   - [ ] Linting sin errores críticos (`npm run lint`)
   - [ ] Migraciones de base de datos aplicadas
   - [ ] Variables de entorno actualizadas en Vercel

2. **Deployment**
   ```bash
   # Push a main branch triggers automatic deployment
   git push origin main
   
   # O deploy manual
   vercel --prod
   ```

3. **Post-deployment Verification**
   - [ ] Verificar health check: `GET /api/health`
   - [ ] Verificar que servicios críticos responden
   - [ ] Monitorear Sentry por errores nuevos
   - [ ] Verificar logs en Vercel dashboard

### Migraciones de Base de Datos

1. **Aplicar migraciones nuevas**
   ```sql
   -- Ejecutar en Supabase SQL Editor o via CLI
   \i migrations/032_audit_logs.sql
   ```

2. **Verificar migraciones**
   ```sql
   SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;
   ```

3. **Rollback (si es necesario)**
   - Revisar contenido de la migración
   - Crear migration de rollback manual
   - Ejecutar con cuidado

---

## Troubleshooting

### Dashboard Carga Lento

**Síntomas**: Dashboard tarda más de 5 segundos en cargar

**Diagnóstico**:
1. Verificar queries lentas en Supabase Dashboard > Database > Query Performance
2. Revisar si `tenant_stats_mv` está actualizada:
   ```sql
   SELECT * FROM tenant_stats_mv LIMIT 1;
   ```
3. Verificar si cron job de refresh está corriendo:
   - Vercel Cron logs
   - Endpoint `/api/cron/refresh-tenant-stats`

**Solución**:
- Ejecutar refresh manual: `GET /api/cron/refresh-tenant-stats`
- Verificar índices en tablas consultadas
- Revisar network tab en DevTools para identificar queries lentas

### Errores de Rate Limiting

**Síntomas**: Usuarios reportan errores 429 "Rate limit exceeded"

**Diagnóstico**:
1. Verificar Redis connection:
   ```bash
   # En Supabase o Redis CLI
   redis-cli PING
   ```
2. Revisar logs de rate limiting en aplicación
3. Verificar límites configurados en `src/lib/security/rate-limit.ts`

**Solución**:
- Si Redis está caído, la app funciona pero sin rate limiting (menos seguro)
- Verificar configuración de Redis en Vercel environment variables
- Ajustar límites si son muy restrictivos

### Errores de Autenticación

**Síntomas**: Usuarios no pueden iniciar sesión o son deslogueados frecuentemente

**Diagnóstico**:
1. Verificar Supabase Auth está operativo
2. Revisar tokens JWT expirando demasiado pronto
3. Verificar variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Solución**:
- Verificar configuración de JWT expiration en Supabase Auth settings
- Si problema persiste, revisar cookies/session storage en navegador

### Problemas con Webhooks

**Síntomas**: Leads de Meta/Facebook no llegan o se duplican

**Diagnóstico**:
1. Verificar logs de webhook en `GET /api/webhooks/meta-leads`
2. Revisar idempotency en `lead_sources` table
3. Verificar configuración de webhook en Meta Developer Console

**Solución**:
- Verificar `VERIFY_TOKEN` en Meta webhook config
- Revisar que `leadgen_id` se usa para idempotency
- Verificar que webhook URL está correcta en Meta

### Errores de Integración con OpenAI

**Síntomas**: RAG search no funciona o embeddings fallan

**Diagnóstico**:
1. Verificar API key de OpenAI:
   ```bash
   echo $OPENAI_API_KEY | cut -c1-10  # Verificar que existe
   ```
2. Revisar cuota de OpenAI en dashboard
3. Verificar logs de errores en Sentry

**Solución**:
- Si API key inválida: actualizar en Vercel environment variables
- Si cuota excedida: aumentar límite en OpenAI dashboard o reducir usage
- Verificar que modelo configurado existe (`text-embedding-3-small`)

### Problemas con Stripe

**Síntomas**: Pagos no se procesan o créditos no se agregan

**Diagnóstico**:
1. Verificar webhook de Stripe en Stripe Dashboard > Webhooks
2. Revisar logs de webhook en `/api/webhooks/stripe`
3. Verificar que `billing_orders` se crean correctamente

**Solución**:
- Verificar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en Vercel
- Re-enviar eventos fallidos desde Stripe Dashboard
- Revisar que `add_credits` RPC function funciona correctamente

---

## Respuesta a Incidentes

### Severidad P0: Sistema Caído

**Procedimiento**:
1. **Identificar**: Monitorear Sentry + Vercel status + Health check
2. **Escalar**: Notificar al equipo inmediatamente
3. **Mitigar**:
   - Verificar Vercel status page
   - Verificar Supabase status
   - Revisar últimos deployments
4. **Resolver**:
   - Rollback a versión estable si deployment reciente causó el problema
   - Verificar logs en Vercel + Sentry
   - Aplicar hotfix si es necesario

**Checklist**:
- [ ] Health check endpoint responde
- [ ] Base de datos accesible
- [ ] Servicios externos (OpenAI, Stripe, Meta) operativos
- [ ] Último deployment revertido si es necesario

### Severidad P1: Funcionalidad Crítica Rota

**Ejemplos**: 
- No se pueden crear tenants
- Pagos no funcionan
- Leads no se procesan

**Procedimiento**:
1. **Identificar**: Revisar Sentry por errores relacionados
2. **Aislar**: Identificar componente/servicio afectado
3. **Mitigar**: 
   - Si es feature específica, deshabilitar temporalmente
   - Comunicar a usuarios afectados
4. **Resolver**: 
   - Revisar logs detallados
   - Aplicar fix y deploy

### Severidad P2: Degradación de Performance

**Ejemplos**:
- Dashboard carga lento
- Queries timeout

**Procedimiento**:
1. **Identificar**: Monitorear tiempos de respuesta
2. **Diagnosticar**: Usar EXPLAIN ANALYZE en queries lentas
3. **Mitigar**: 
   - Agregar índices temporales si es necesario
   - Escalar recursos si es posible
4. **Resolver**: 
   - Optimizar queries
   - Agregar índices permanentes
   - Considerar materialized views

---

## Mantenimiento

### Backup de Base de Datos

**Frecuencia**: Diaria (automático en Supabase Pro+)

**Verificación**:
1. Supabase Dashboard > Database > Backups
2. Verificar que backups recientes existen

**Restauración**:
1. Supabase Dashboard > Database > Backups
2. Seleccionar punto de restauración
3. Confirmar restauración (cuidado: sobrescribe datos actuales)

### Actualización de Dependencias

**Frecuencia**: Mensual

**Proceso**:
```bash
# Verificar vulnerabilidades
npm audit

# Actualizar dependencias
npm update

# Actualizar dependencias mayores (cuidado)
npm install package@latest

# Ejecutar tests después de actualizar
npm run test
npm run typecheck
npm run build
```

### Limpieza de Datos Antiguos

**Audit Logs**: Mantener 90 días (configurar en Supabase)

**Logs de Aplicación**: Vercel mantiene logs por 30 días

**Archivos de Storage**: Revisar periódicamente archivos no utilizados

### Monitoreo de Costos

**Recursos a Monitorear**:
- Supabase: Database, Auth, Storage
- Vercel: Edge Functions, Bandwidth
- OpenAI: API usage
- Stripe: Transaction fees

**Alertas**:
- Configurar alertas en cada servicio cuando se acerque al límite

---

## Comandos Útiles

### Database

```sql
-- Ver tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Ver queries activas
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Ver índices no utilizados
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

### Application

```bash
# Verificar variables de entorno locales
cat .env.local

# Ejecutar typecheck
npm run typecheck

# Ejecutar linting
npm run lint

# Build local
npm run build

# Ejecutar tests
npm run test
```

---

## Contactos de Emergencia

- **DevOps/SRE**: [Agregar contacto]
- **Backend Lead**: [Agregar contacto]
- **Frontend Lead**: [Agregar contacto]
- **Supabase Support**: https://supabase.com/support
- **Vercel Support**: https://vercel.com/support

---

## Changelog de Runbooks

- **2025-01-07**: Versión inicial creada
  - Deployment process
  - Troubleshooting común
  - Incident response procedures
  - Maintenance tasks
