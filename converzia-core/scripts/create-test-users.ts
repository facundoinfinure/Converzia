#!/usr/bin/env ts-node
/**
 * Script para crear usuarios de prueba en Supabase
 * 
 * Uso:
 *   npx ts-node scripts/create-test-users.ts
 * 
 * Requiere variables de entorno:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Se requieren SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Ejemplo de uso:');
  console.error('  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npx ts-node scripts/create-test-users.ts');
  process.exit(1);
}

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
  isAdmin: boolean;
  tenantId?: string;
  role?: 'OWNER' | 'ADMIN' | 'VIEWER';
}

const TEST_USERS: TestUser[] = [
  // Converzia Admin
  {
    email: 'admin@converzia.io',
    password: 'Test123!',
    fullName: 'Admin Converzia',
    isAdmin: true,
  },
  // Demo Inmobiliaria
  {
    email: 'owner1@test.com',
    password: 'Test123!',
    fullName: 'Owner Demo Inmobiliaria',
    isAdmin: false,
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    role: 'OWNER',
  },
  {
    email: 'admin1@test.com',
    password: 'Test123!',
    fullName: 'Admin Demo Inmobiliaria',
    isAdmin: false,
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    role: 'ADMIN',
  },
  {
    email: 'viewer1@test.com',
    password: 'Test123!',
    fullName: 'Viewer Demo Inmobiliaria',
    isAdmin: false,
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    role: 'VIEWER',
  },
  // Demo Automotriz
  {
    email: 'owner2@test.com',
    password: 'Test123!',
    fullName: 'Owner Demo Automotriz',
    isAdmin: false,
    tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    role: 'OWNER',
  },
  {
    email: 'admin2@test.com',
    password: 'Test123!',
    fullName: 'Admin Demo Automotriz',
    isAdmin: false,
    tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    role: 'ADMIN',
  },
  {
    email: 'viewer2@test.com',
    password: 'Test123!',
    fullName: 'Viewer Demo Automotriz',
    isAdmin: false,
    tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    role: 'VIEWER',
  },
];

async function createUser(user: TestUser): Promise<string | null> {
  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === user.email);

    let userId: string;

    if (existingUser) {
      console.log(`  ⚠️  Usuario ${user.email} ya existe, actualizando...`);
      userId = existingUser.id;

      // Update user metadata
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: user.fullName },
      });
    } else {
      // Create new user
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
        },
      });

      if (error) {
        console.error(`  ❌ Error creando usuario ${user.email}:`, error.message);
        return null;
      }

      userId = newUser.user.id;
      console.log(`  ✅ Usuario ${user.email} creado (ID: ${userId})`);
    }

    // Update or create profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        email: user.email,
        full_name: user.fullName,
        is_converzia_admin: user.isAdmin,
      }, {
        onConflict: 'id',
      });

    if (profileError) {
      console.error(`  ⚠️  Error actualizando perfil:`, profileError.message);
    } else {
      console.log(`  ✅ Perfil actualizado`);
    }

    // Create membership if tenant and role are specified
    if (user.tenantId && user.role) {
      const { error: membershipError } = await supabase
        .from('tenant_members')
        .upsert({
          tenant_id: user.tenantId,
          user_id: userId,
          role: user.role,
          status: 'ACTIVE',
        }, {
          onConflict: 'tenant_id,user_id',
        });

      if (membershipError) {
        console.error(`  ⚠️  Error creando membership:`, membershipError.message);
      } else {
        console.log(`  ✅ Membership creado (${user.role})`);
      }
    }

    return userId;
  } catch (error: any) {
    console.error(`  ❌ Error inesperado:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Creando usuarios de prueba...\n');

  const results = {
    created: 0,
    updated: 0,
    errors: 0,
  };

  for (const user of TEST_USERS) {
    console.log(`\n📝 Procesando: ${user.email}`);
    const userId = await createUser(user);
    
    if (userId) {
      // Check if it was created or updated
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);
      if (existingUser && new Date(existingUser.created_at).getTime() > Date.now() - 5000) {
        results.created++;
      } else {
        results.updated++;
      }
    } else {
      results.errors++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Resumen:');
  console.log(`  ✅ Creados: ${results.created}`);
  console.log(`  🔄 Actualizados: ${results.updated}`);
  console.log(`  ❌ Errores: ${results.errors}`);
  console.log('='.repeat(50));
  console.log('\n📋 Usuarios de prueba:');
  console.log('  | Email               | Password  | Role            |');
  console.log('  |---------------------|-----------|-----------------|');
  TEST_USERS.forEach(user => {
    const role = user.isAdmin ? 'Converzia Admin' : `${user.role} (${user.tenantId ? 'Tenant' : 'N/A'})`;
    console.log(`  | ${user.email.padEnd(19)} | Test123!  | ${role.padEnd(15)} |`);
  });
  console.log('');
}

main().catch(console.error);










