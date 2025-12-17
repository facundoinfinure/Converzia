"use client";

import { ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/context";
import { ToastProvider, useToast, setToastHandler } from "@/components/ui/Toast";

// ============================================
// React Query Client
// ============================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ============================================
// Providers Wrapper
// ============================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider position="bottom-right">
        <AuthProvider>
          <ToastInitializer />
          {children}
        </AuthProvider>
      </ToastProvider>
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

