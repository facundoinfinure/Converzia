/**
 * Feature Flags System
 * 
 * Simple feature flag implementation for Converzia.
 * Supports environment-based, user-based, and tenant-based feature toggles.
 */

// ============================================
// Feature Flag Definitions
// ============================================

export type FeatureFlagName =
  | "pwa_enabled"
  | "push_notifications"
  | "realtime_updates"
  | "advanced_analytics"
  | "meta_ads_integration"
  | "google_sheets_integration"
  | "multi_language"
  | "dark_mode"
  | "bulk_actions"
  | "export_csv"
  | "rag_search"
  | "ai_qualification";

interface FeatureFlag {
  name: FeatureFlagName;
  description: string;
  defaultValue: boolean;
  // Optional: specific environments where this is enabled
  enabledInEnvs?: ("development" | "staging" | "production")[];
}

// ============================================
// Feature Flag Registry
// ============================================

const featureFlags: FeatureFlag[] = [
  {
    name: "pwa_enabled",
    description: "Enable Progressive Web App features",
    defaultValue: true,
  },
  {
    name: "push_notifications",
    description: "Enable Web Push notifications",
    defaultValue: true,
  },
  {
    name: "realtime_updates",
    description: "Enable Supabase Realtime subscriptions",
    defaultValue: true,
  },
  {
    name: "advanced_analytics",
    description: "Enable advanced analytics dashboard",
    defaultValue: false,
    enabledInEnvs: ["development", "staging"],
  },
  {
    name: "meta_ads_integration",
    description: "Enable Meta Ads integration",
    defaultValue: true,
  },
  {
    name: "google_sheets_integration",
    description: "Enable Google Sheets export",
    defaultValue: true,
  },
  {
    name: "multi_language",
    description: "Enable multi-language support",
    defaultValue: false,
    enabledInEnvs: ["development"],
  },
  {
    name: "dark_mode",
    description: "Enable dark mode toggle",
    defaultValue: true,
  },
  {
    name: "bulk_actions",
    description: "Enable bulk actions on leads",
    defaultValue: true,
  },
  {
    name: "export_csv",
    description: "Enable CSV export functionality",
    defaultValue: true,
  },
  {
    name: "rag_search",
    description: "Enable RAG-based context search for AI",
    defaultValue: true,
  },
  {
    name: "ai_qualification",
    description: "Enable AI-based lead qualification",
    defaultValue: true,
  },
];

// ============================================
// Environment Detection
// ============================================

type Environment = "development" | "staging" | "production";

function getCurrentEnvironment(): Environment {
  if (process.env.NODE_ENV === "development") {
    return "development";
  }
  
  // Check for staging environment (e.g., preview deployments)
  if (
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
  ) {
    return "staging";
  }
  
  return "production";
}

// ============================================
// Feature Flag State
// ============================================

// Runtime overrides (can be set per-user or per-tenant)
const runtimeOverrides: Map<string, Record<FeatureFlagName, boolean>> = new Map();

// ============================================
// Public API
// ============================================

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
  featureName: FeatureFlagName,
  context?: { userId?: string; tenantId?: string }
): boolean {
  const flag = featureFlags.find((f) => f.name === featureName);
  
  if (!flag) {
    console.warn(`[FeatureFlags] Unknown feature: ${featureName}`);
    return false;
  }
  
  // Check environment-based override
  if (flag.enabledInEnvs) {
    const env = getCurrentEnvironment();
    if (!flag.enabledInEnvs.includes(env)) {
      return false;
    }
  }
  
  // Check user/tenant overrides
  const overrideKey = context?.tenantId || context?.userId;
  if (overrideKey && runtimeOverrides.has(overrideKey)) {
    const overrides = runtimeOverrides.get(overrideKey)!;
    if (featureName in overrides) {
      return overrides[featureName];
    }
  }
  
  // Check environment variable override
  const envVar = `FEATURE_${featureName.toUpperCase()}`;
  if (process.env[envVar] !== undefined) {
    return process.env[envVar] === "true";
  }
  
  return flag.defaultValue;
}

/**
 * Set feature flag override for a specific user or tenant
 */
export function setFeatureOverride(
  key: string, // userId or tenantId
  featureName: FeatureFlagName,
  enabled: boolean
): void {
  const existing = runtimeOverrides.get(key) || ({} as Record<FeatureFlagName, boolean>);
  existing[featureName] = enabled;
  runtimeOverrides.set(key, existing);
}

/**
 * Clear all overrides for a user or tenant
 */
export function clearFeatureOverrides(key: string): void {
  runtimeOverrides.delete(key);
}

/**
 * Get all feature flags with their current values
 */
export function getAllFeatureFlags(
  context?: { userId?: string; tenantId?: string }
): Record<FeatureFlagName, { enabled: boolean; description: string }> {
  const result = {} as Record<FeatureFlagName, { enabled: boolean; description: string }>;
  
  for (const flag of featureFlags) {
    result[flag.name] = {
      enabled: isFeatureEnabled(flag.name, context),
      description: flag.description,
    };
  }
  
  return result;
}

// ============================================
// React Hook
// ============================================

/**
 * React hook for checking feature flags
 * Usage: const isPwaEnabled = useFeatureFlag("pwa_enabled");
 */
export function useFeatureFlag(featureName: FeatureFlagName): boolean {
  // In a more complex implementation, this would use context
  // to get userId and tenantId automatically
  return isFeatureEnabled(featureName);
}

/**
 * Higher-order component for feature-gated components
 */
export function withFeatureFlag<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureName: FeatureFlagName,
  fallback: React.ReactNode = null
): React.FC<P> {
  return function FeatureFlaggedComponent(props: P) {
    const enabled = isFeatureEnabled(featureName);
    
    if (!enabled) {
      return <>{fallback}</>;
    }
    
    return <WrappedComponent {...props} />;
  };
}

// ============================================
// Server-side Utilities
// ============================================

/**
 * Get feature flags for a specific tenant (for API responses)
 */
export function getTenantFeatureFlags(tenantId: string): Record<FeatureFlagName, boolean> {
  const result = {} as Record<FeatureFlagName, boolean>;
  
  for (const flag of featureFlags) {
    result[flag.name] = isFeatureEnabled(flag.name, { tenantId });
  }
  
  return result;
}
