"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Mail, LogOut, RefreshCw, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, profile, signOut, isLoading, refreshAuth } = useAuth();
  const supabase = createClient();
  const [pageLoading, setPageLoading] = useState(true);

  // Intelligent polling for approval status
  useEffect(() => {
    if (isLoading || !user) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const maxPolls = 120; // Stop after 10 minutes (5 second intervals)

    const checkApproval = async () => {
      if (pollCount >= maxPolls) {
        if (pollInterval) clearInterval(pollInterval);
        return;
      }

      pollCount++;

      try {
        const { data: memberships, error } = await queryWithTimeout(
          supabase
            .from("tenant_members")
            .select("id, status, tenant:tenants(status)")
            .eq("user_id", user.id),
          10000,
          "check approval status"
        );

        if (error) {
          console.error("Error checking approval status:", error);
          return;
        }

        if (memberships && (memberships as any[]).length > 0) {
          const hasActive = (memberships as any[]).some(
            (m: any) => m.status === "ACTIVE" && m.tenant?.status === "ACTIVE"
          );
          if (hasActive) {
            if (pollInterval) clearInterval(pollInterval);
            router.push("/portal");
          }
        }
      } catch (err) {
        console.error("Error in checkApproval:", err);
      }
    };

    // Initial check
    checkApproval();

    // Poll every 5 seconds (exponential backoff: 5s, 10s, 15s, then 30s)
    let pollDelay = 5000;
    const startPolling = () => {
      pollInterval = setTimeout(() => {
        checkApproval();
        // Increase delay after first few polls (5s -> 10s -> 15s -> 30s)
        if (pollCount < 3) {
          pollDelay = pollDelay + 5000;
        } else if (pollCount < 6) {
          pollDelay = 15000;
        } else {
          pollDelay = 30000; // 30 seconds after 6 polls
        }
        if (pollCount < maxPolls) {
          startPolling();
        }
      }, pollDelay);
    };

    startPolling();

    return () => {
      if (pollInterval) clearTimeout(pollInterval);
    };
  }, [user, isLoading, router, supabase]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Set page loading to false after auth is loaded (with timeout as fallback)
  useEffect(() => {
    if (!isLoading) {
      setPageLoading(false);
    } else {
      // Timeout fallback: if auth is still loading after 5 seconds, show the page anyway
      const timeout = setTimeout(() => {
        console.warn("Auth loading timeout, showing page anyway");
        setPageLoading(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  const handleRefresh = async () => {
    try {
      await refreshAuth();
      
      // Re-check status after refresh
      if (user) {
        const { data: memberships, error } = await queryWithTimeout(
          supabase
            .from("tenant_members")
            .select("id, status, tenant:tenants(status)")
            .eq("user_id", user.id),
          10000,
          "check approval status"
        );

        if (error) {
          console.error("Error checking approval status:", error);
          return;
        }

        if (memberships && (memberships as any[]).length > 0) {
          const hasActive = (memberships as any[]).some(
            (m: any) => m.status === "ACTIVE" && m.tenant?.status === "ACTIVE"
          );
          if (hasActive) {
            router.push("/portal");
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing approval status:", err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (isLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card>
          <CardContent className="p-8 text-center">
            {/* Icon */}
            <div className="h-20 w-20 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
              <Clock className="h-10 w-10 text-amber-400" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white mb-2">
              Solicitud en revisión
            </h1>
            <p className="text-slate-400 mb-6">
              Tu solicitud de acceso está siendo revisada por nuestro equipo. Te notificaremos por email cuando esté aprobada.
            </p>

            {/* User info */}
            {profile?.email && (
              <div className="mb-6 p-4 rounded-lg bg-card-border/50">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                  <Mail className="h-4 w-4" />
                  <span>{profile.email}</span>
                </div>
              </div>
            )}

            {/* Timeline info */}
            <div className="mb-8 p-4 rounded-lg bg-primary-500/10 border border-primary-500/20">
              <p className="text-sm text-primary-300">
                Normalmente respondemos dentro de las próximas 24-48 horas hábiles.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={handleRefresh}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Verificar estado
              </Button>

              <a
                href="mailto:soporte@converzia.io"
                className="block"
              >
                <Button
                  variant="ghost"
                  fullWidth
                  leftIcon={<MessageCircle className="h-4 w-4" />}
                >
                  Contactar soporte
                </Button>
              </a>

              <div className="pt-2 border-t border-card-border">
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={handleSignOut}
                  leftIcon={<LogOut className="h-4 w-4" />}
                  className="text-slate-500 hover:text-white"
                >
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help text */}
        <p className="text-center text-sm text-slate-500 mt-6">
          ¿Ya fuiste aprobado? Probá{" "}
          <button
            onClick={handleRefresh}
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            refrescando la página
          </button>
        </p>
      </div>
    </div>
  );
}






