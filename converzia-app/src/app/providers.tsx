"use client";

import { ReactNode, useEffect } from "react";
import { AuthProvider } from "@/lib/auth/context";
import { ToastProvider, useToast, setToastHandler } from "@/components/ui/Toast";

// ============================================
// Providers Wrapper
// ============================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider position="bottom-right">
      <AuthProvider>
        <ToastInitializer />
        {children}
      </AuthProvider>
    </ToastProvider>
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

