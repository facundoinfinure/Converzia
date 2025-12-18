#!/usr/bin/env tsx
/**
 * Script para crear usuarios de prueba en Supabase Auth
 * 
 * Este script usa la API de administración de Supabase para crear usuarios
 * con contraseñas correctamente hasheadas.
 * 
 * Uso:
 *   tsx scripts/create-test-users.ts
 * 
 * Requiere:
 *   - SUPABASE_URL en .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Cargar variables de entorno
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Intentar cargar desde el directorio raíz
  dotenv.config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Crear cliente con service_role (permisos de administrador)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  isConverziaAdmin: boolean;
  tenantId?: string;
  role?: 'OWNER' | 'ADMIN' | 'VIEWER';
}

const testUsers: TestUser[] = [
  // Converzia Admin
  {
    email: 'admin@converzia.io',
    password: 'Test123!',
    fullName: 'Admin Converzia',
    isConverziaAdmin: true
  },
  // Demo Inmobiliaria
  {
    email: 'owner1@test.com',
    password: 'Test123!',
    fullName: 'Owner Demo Inmobiliaria',
    isConverziaAdmin: false,
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    role: 'OWNER'
  },
  {
    email: 'admin1@test.com',
    password: 'Test123!',
    fullName: 'Admin Demo Inmobiliaria',
    isConverziaAdmin: false,
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    role: 'ADMIN'
  },
  {
    email: 'viewer1@test.com',
    password: 'Test123!',
    fullName: 'Viewer Demo Inmobiliaria',
    isConverziaAdmin: false,
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    role: 'VIEWER'
  },
  // Demo Automotriz
  {
    email: 'owner2@test.com',
    password: 'Test123!',
    fullName: 'Owner Demo Automotriz',
    isConverziaAdmin: false,
    tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    role: 'OWNER'
  },
  {
    email: 'admin2@test.com',
    password: 'Test123!',
    fullName: 'Admin Demo Automotriz',
    isConverziaAdmin: false,
    tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    role: 'ADMIN'
  },
  {
    email: 'viewer2@test.com',
    password: 'Test123!',
    fullName: 'Viewer Demo Automotriz',
    isConverziaAdmin: false,
    tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    role: 'VIEWER'
  }
];

async function createUser(user: TestUser): Promise<string | null> {
  try {
    // Verificar si el usuario ya existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === user.email);

    if (existingUser) {
      console.log(`⚠️  Usuario ${user.email} ya existe (ID: ${existingUser.id})`);
      
      // Actualizar perfil si existe
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: existingUser.id,
          email: user.email,
          full_name: user.fullName,
          is_converzia_admin: user.isConverziaAdmin
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error(`   Error actualizando perfil: ${profileError.message}`);
      } else {
        console.log(`   ✓ Perfil actualizado`);
      }

      // Actualizar contraseña si es necesario
      if (user.password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          { password: user.password }
        );
        if (passwordError) {
          console.error(`   Error actualizando contraseña: ${passwordError.message}`);
        } else {
          console.log(`   ✓ Contraseña actualizada`);
        }
      }

      return existingUser.id;
    }

    // Crear nuevo usuario usando la API de administración
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: {
        full_name: user.fullName
      }
    });

    if (createError) {
      console.error(`❌ Error creando usuario ${user.email}: ${createError.message}`);
      return null;
    }

    if (!newUser.user) {
      console.error(`❌ No se pudo crear usuario ${user.email}`);
      return null;
    }

    console.log(`✓ Usuario creado: ${user.email} (ID: ${newUser.user.id})`);

    // Crear perfil de usuario
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: newUser.user.id,
        email: user.email,
        full_name: user.fullName,
        is_converzia_admin: user.isConverziaAdmin
      });

    if (profileError) {
      console.error(`   ⚠️  Error creando perfil: ${profileError.message}`);
    } else {
      console.log(`   ✓ Perfil creado`);
    }

    return newUser.user.id;
  } catch (error) {
    console.error(`❌ Error inesperado creando usuario ${user.email}:`, error);
    return null;
  }
}

async function createMembership(userId: string, tenantId: string, role: string) {
  try {
    const { error } = await supabase
      .from('tenant_members')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        role: role,
        status: 'ACTIVE'
      }, {
        onConflict: 'tenant_id,user_id'
      });

    if (error) {
      console.error(`   ⚠️  Error creando membership: ${error.message}`);
    } else {
      console.log(`   ✓ Membership creado (${role})`);
    }
  } catch (error) {
    console.error(`   ❌ Error inesperado creando membership:`, error);
  }
}

async function main() {
  console.log('🚀 Creando usuarios de prueba...\n');
  console.log(`📡 Conectado a: ${SUPABASE_URL}\n`);

  for (const user of testUsers) {
    console.log(`\n📝 Procesando: ${user.email}`);
    const userId = await createUser(user);

    if (userId && user.tenantId && user.role) {
      await createMembership(userId, user.tenantId, user.role);
    }
  }

  console.log('\n✅ Proceso completado!\n');
  console.log('📋 Resumen de usuarios:');
  console.log('   Email               | Password  | Rol');
  console.log('   --------------------|-----------|-----------------');
  testUsers.forEach(u => {
    const role = u.isConverziaAdmin ? 'Converzia Admin' : u.role || 'N/A';
    console.log(`   ${u.email.padEnd(20)} | Test123!  | ${role}`);
  });
  console.log('\n');
}

main().catch(console.error);

