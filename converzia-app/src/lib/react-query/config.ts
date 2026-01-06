/**
 * React Query configuration
 * Configura caching, retries, y stale time optimizado por tipo de dato
 */

import { QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/utils/logger';

/**
 * Create a new QueryClient with optimized defaults
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache por defecto: 5 minutos
        staleTime: 1000 * 60 * 5,
        // Mantener en cache: 10 minutos
        gcTime: 1000 * 60 * 10,
        // Retry automático en caso de error
        retry: (failureCount, error: any) => {
          // No reintentar en errores 4xx (client errors)
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          // Máximo 2 reintentos para 5xx
          return failureCount < 2;
        },
        // No refetch en window focus por defecto (muy molesto)
        refetchOnWindowFocus: false,
        // Refetch on mount solo si está stale
        refetchOnMount: true,
        // Refetch en reconnect (útil para mobile)
        refetchOnReconnect: true,
      },
      mutations: {
        // Retry mutations solo una vez
        retry: 1,
        // Error handler global
        onError: (error: any) => {
          logger.error('Mutation error', error);
        },
      },
    },
  });
}

/**
 * Query key factories
 * Centraliza la creación de query keys para evitar duplicados
 */
export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
    profile: () => [...queryKeys.auth.all, 'profile'] as const,
    memberships: () => [...queryKeys.auth.all, 'memberships'] as const,
  },

  // Tenants
  tenants: {
    all: ['tenants'] as const,
    lists: () => [...queryKeys.tenants.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.tenants.lists(), filters] as const,
    details: () => [...queryKeys.tenants.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tenants.details(), id] as const,
    stats: (id: string) => [...queryKeys.tenants.detail(id), 'stats'] as const,
    pricing: (id: string) => [...queryKeys.tenants.detail(id), 'pricing'] as const,
  },

  // Offers
  offers: {
    all: ['offers'] as const,
    lists: () => [...queryKeys.offers.all, 'list'] as const,
    list: (tenantId: string, filters: Record<string, any>) =>
      [...queryKeys.offers.lists(), tenantId, filters] as const,
    details: () => [...queryKeys.offers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.offers.details(), id] as const,
    scoringTemplate: (id: string) =>
      [...queryKeys.offers.detail(id), 'scoring'] as const,
  },

  // Leads
  leads: {
    all: ['leads'] as const,
    lists: () => [...queryKeys.leads.all, 'list'] as const,
    list: (tenantId: string, filters: Record<string, any>) =>
      [...queryKeys.leads.lists(), tenantId, filters] as const,
    details: () => [...queryKeys.leads.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.leads.details(), id] as const,
    conversation: (id: string) =>
      [...queryKeys.leads.detail(id), 'conversation'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },

  // Ad Mappings
  adMappings: {
    all: ['ad-mappings'] as const,
    lists: () => [...queryKeys.adMappings.all, 'list'] as const,
    list: (tenantId: string) =>
      [...queryKeys.adMappings.lists(), tenantId] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    dashboard: (tenantId: string, dateRange: string) =>
      [...queryKeys.analytics.all, 'dashboard', tenantId, dateRange] as const,
    leadsTrend: (tenantId: string, period: string) =>
      [...queryKeys.analytics.all, 'leads-trend', tenantId, period] as const,
  },

  // Credits
  credits: {
    all: ['credits'] as const,
    balance: (tenantId: string) =>
      [...queryKeys.credits.all, 'balance', tenantId] as const,
    ledger: (tenantId: string, filters: Record<string, any>) =>
      [...queryKeys.credits.all, 'ledger', tenantId, filters] as const,
  },
} as const;

/**
 * Configuraciones de staleTime optimizadas por tipo de dato
 */
export const STALE_TIMES = {
  // Datos que casi nunca cambian
  STATIC: 1000 * 60 * 60, // 1 hora

  // Datos que cambian poco
  SLOW: 1000 * 60 * 15, // 15 minutos

  // Datos de actualización normal
  NORMAL: 1000 * 60 * 5, // 5 minutos

  // Datos que cambian frecuentemente
  FAST: 1000 * 60, // 1 minuto

  // Datos en tiempo real (casi siempre refetch)
  REALTIME: 1000 * 10, // 10 segundos
} as const;
