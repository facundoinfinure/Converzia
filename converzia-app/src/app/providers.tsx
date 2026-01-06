"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "@/lib/auth/context";
import { DashboardProvider } from "@/lib/contexts/dashboard-context";
import { ToastProvider, useToast, setToastHandler } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { createQueryClient } from "@/lib/react-query/config";

// ============================================
// React Query Client
// ============================================

// Create query client per-request to avoid sharing state between requests
// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr

// ============================================
// Providers Wrapper
// ============================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Create query client in state to ensure it's only created once per mount
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <ToastProvider position="bottom-right">
          <AuthProvider>
            <DashboardProvider>
              <DashboardInitializer />
              <ToastInitializer />
              {children}
            </DashboardProvider>
          </AuthProvider>
        </ToastProvider>
      </TooltipProvider>
      {/* React Query Devtools - solo en desarrollo */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

// ============================================
// Toast Initializer (for external toast access)
// ============================================

function ToastInitializer() {
  const toast = useToast();

  useEffect(() => {
    setToastHandler(toast);
  }, [toast]);

  return null;
}

// ============================================
// Dashboard Initializer (triggers initial load)
// ============================================

import { useDashboardInitialLoad } from "@/lib/hooks/use-dashboard-initial-load";
import { useDashboardPolling } from "@/lib/hooks/use-dashboard-polling";

function DashboardInitializer() {
  // This hook will trigger the initial load when activeTenantId is available
  useDashboardInitialLoad();
  useDashboardPolling();
  return null;
}
