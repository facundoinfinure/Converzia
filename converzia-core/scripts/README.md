# Scripts de Converzia

## Crear Usuarios de Prueba

### Opción 1: Script de Node.js (Recomendado)

El script más fácil de usar es el de TypeScript que usa la API de Supabase:

```bash
cd converzia-core
SUPABASE_URL=https://tu-proyecto.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key \
npx ts-node scripts/create-test-users.ts
```

**Requisitos:**
- Node.js instalado
- Variables de entorno configuradas:
  - `SUPABASE_URL`: URL de tu proyecto Supabase
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (encontrarla en Supabase Dashboard > Settings > API)

### Opción 2: SQL Directo

Si prefieres usar SQL directamente:

1. Ve a Supabase Dashboard > SQL Editor
2. Asegúrate de estar usando el service_role (no el anon key)
3. Ejecuta el archivo `converzia-core/seed/002_test_users.sql`

**Nota:** El script SQL crea una función helper `create_test_user_if_not_exists` que hace el proceso más robusto.

### Opción 3: Dashboard de Supabase

1. Ve a Supabase Dashboard > Authentication > Users
2. Crea cada usuario manualmente
3. Luego ejecuta la parte del script SQL que crea los perfiles y memberships (líneas 122-172)

## Usuarios de Prueba Creados

| Email               | Password  | Role            | Tenant             |
|---------------------|-----------|-----------------|-------------------|
| admin@converzia.io  | Test123!  | Converzia Admin | (all access)      |
| owner1@test.com     | Test123!  | OWNER           | Demo Inmobiliaria |
| admin1@test.com     | Test123!  | ADMIN           | Demo Inmobiliaria |
| viewer1@test.com    | Test123!  | VIEWER          | Demo Inmobiliaria |
| owner2@test.com     | Test123!  | OWNER           | Demo Automotriz   |
| admin2@test.com     | Test123!  | ADMIN           | Demo Automotriz   |
| viewer2@test.com    | Test123!  | VIEWER          | Demo Automotriz   |

## Troubleshooting

### Error: "Insufficient permissions"
- Asegúrate de usar el `SUPABASE_SERVICE_ROLE_KEY`, no el `anon` key
- El service_role key tiene permisos completos para crear usuarios

### Error: "User already exists"
- El script está diseñado para ser idempotente
- Si un usuario ya existe, se actualizará en lugar de crear uno nuevo

### Error: "Tenant not found"
- Asegúrate de ejecutar primero `001_initial_seed.sql` o crear los tenants manualmente
- Los tenant IDs están hardcodeados en el script:
  - Demo Inmobiliaria: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
  - Demo Automotriz: `b2c3d4e5-f6a7-8901-bcde-f23456789012`







