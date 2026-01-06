/**
 * Server Actions for Tenants
 * Next.js 15 Server Actions - Type-safe, CSRF-protected mutations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { queryWithTimeout } from '@/lib/supabase/query-with-timeout';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import type { Database, Tables } from '@/types/database';

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  timezone: z.string().default('America/Argentina/Buenos_Aires'),
});

const updateTenantSchema = createTenantSchema.partial();

/**
 * Create a new tenant
 */
export async function createTenant(formData: FormData) {
  try {
    // Parse and validate form data
    const rawData = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      contact_email: formData.get('contact_email'),
      contact_phone: formData.get('contact_phone'),
      timezone: formData.get('timezone'),
    };

    const validated = createTenantSchema.parse(rawData);

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Insert tenant
    const { data, error } = await queryWithTimeout(
      supabase
        .from('tenants')
        .insert({
          name: validated.name,
          slug: validated.slug,
          contact_email: validated.contact_email,
          contact_phone: validated.contact_phone,
          timezone: validated.timezone,
          status: 'PENDING',
          default_score_threshold: 70,
          duplicate_window_days: 7,
          settings: {},
        })
        .select()
        .single(),
      10000,
      'create tenant'
    );

    if (error || !data) throw error ?? new Error('Failed to create tenant');

    const tenant = data as Tables<'tenants'>;
    logger.info('Tenant created via Server Action', {
      tenantId: tenant.id,
      name: tenant.name,
    });

    // Revalidate tenants list
    revalidatePath('/admin/tenants');
    revalidatePath('/portal');

    return { success: true, data: tenant };
  } catch (error) {
    logger.error('Error creating tenant', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update tenant
 */
export async function updateTenant(tenantId: string, formData: FormData) {
  try {
    const rawData = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      contact_email: formData.get('contact_email'),
      contact_phone: formData.get('contact_phone'),
    };

    const validated = updateTenantSchema.parse(rawData);

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data, error } = await queryWithTimeout(
      supabase
        .from('tenants')
        .update({ ...validated, updated_at: new Date().toISOString() })
        .eq('id', tenantId)
        .select()
        .single(),
      10000,
      `update tenant ${tenantId}`
    );

    if (error) throw error;

    logger.info('Tenant updated via Server Action', { tenantId });

    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath('/admin/tenants');

    return { success: true, data };
  } catch (error) {
    logger.error('Error updating tenant', error);

    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update tenant status
 */
export async function updateTenantStatus(
  tenantId: string,
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'ACTIVE') {
      updateData.activated_at = new Date().toISOString();
    }

    const { data, error } = await queryWithTimeout(
      supabase
        .from('tenants')
        .update(updateData)
        .eq('id', tenantId)
        .select()
        .single(),
      10000,
      `update tenant status ${tenantId}`
    );

    if (error) throw error;

    logger.info('Tenant status updated', { tenantId, status });

    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath('/admin/tenants');

    return { success: true, data };
  } catch (error) {
    logger.error('Error updating tenant status', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete tenant
 */
export async function deleteTenant(tenantId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { error } = await queryWithTimeout(
      supabase.from('tenants').delete().eq('id', tenantId),
      10000,
      `delete tenant ${tenantId}`
    );

    if (error) throw error;

    logger.info('Tenant deleted', { tenantId });

    revalidatePath('/admin/tenants');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting tenant', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
