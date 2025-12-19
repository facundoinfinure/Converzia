# Scripts de Utilidad

## create-test-users.ts

Script para crear usuarios de prueba en Supabase Auth con las credenciales correctas.

### Requisitos

1. Variables de entorno configuradas en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` - URL de tu proyecto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY` - Clave de servicio de Supabase

2. Dependencias instaladas:
   ```bash
   npm install
   ```

### Uso

```bash
npm run create-users
```

O directamente:

```bash
npx tsx scripts/create-test-users.ts
```

### Usuarios que se crearán

| Email               | Password  | Rol            | Tenant             |
|---------------------|-----------|----------------|-------------------|
| admin@converzia.io  | Test123!  | Converzia Admin | (all access)      |
| owner1@test.com     | Test123!  | OWNER           | Demo Inmobiliaria |
| admin1@test.com     | Test123!  | ADMIN           | Demo Inmobiliaria |
| viewer1@test.com    | Test123!  | VIEWER          | Demo Inmobiliaria |
| owner2@test.com     | Test123!  | OWNER           | Demo Automotriz   |
| admin2@test.com     | Test123!  | ADMIN           | Demo Automotriz   |
| viewer2@test.com    | Test123!  | VIEWER          | Demo Automotriz   |

### Notas

- El script verifica si los usuarios ya existen y los actualiza si es necesario
- Si un usuario ya existe, se actualizará su contraseña y perfil
- Los tenants deben existir antes de ejecutar el script (ver `converzia-core/seed/002_test_users.sql`)


