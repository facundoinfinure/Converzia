"use client";

import { Button } from "@/components/ui/Button";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="text-center max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-[var(--text-tertiary)]" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
          Sin conexión
        </h1>

        <p className="text-[var(--text-secondary)] mb-8">
          Parece que no tienes conexión a internet. Verifica tu conexión e intenta nuevamente.
        </p>

        <div className="space-y-4">
          <Button 
            onClick={handleRetry}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            fullWidth
          >
            Reintentar
          </Button>

          <p className="text-sm text-[var(--text-tertiary)]">
            Algunas funciones pueden estar disponibles sin conexión si fueron cargadas previamente.
          </p>
        </div>
      </div>

      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 -left-48 w-96 h-96 bg-[var(--accent-primary)] opacity-5 rounded-full blur-3xl"
        />
        <div 
          className="absolute bottom-1/4 -right-48 w-96 h-96 bg-[var(--accent-secondary)] opacity-5 rounded-full blur-3xl"
        />
      </div>
    </div>
  );
}
