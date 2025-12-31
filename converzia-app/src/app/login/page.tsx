"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { cn } from "@/lib/utils";

// Google Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Check for auth errors from callback
  const authError = searchParams.get("error");

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (signInError) {
        setError("Error al conectar con Google. Intentá de nuevo.");
        setIsGoogleLoading(false);
      }
    } catch (err) {
      setError("Error inesperado. Intentá de nuevo.");
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: El login tardó más de 10 segundos")), 10000);
      });

      const { data, error: signInError } = await Promise.race([
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        timeoutPromise,
      ]) as any;

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Email o contraseña incorrectos");
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (data && data.user) {
        const { data: profile } = await queryWithTimeout(
          supabase
            .from("user_profiles")
            .select("is_converzia_admin")
            .eq("id", data.user.id)
            .single(),
          10000,
          "check admin status",
          false
        );

        if ((profile as any)?.is_converzia_admin) {
          router.push("/admin");
        } else {
          const { data: memberships } = await queryWithTimeout(
            supabase
              .from("tenant_members")
              .select("id, status")
              .eq("user_id", data.user.id),
            10000,
            "check memberships",
            false
          ) as { data: { id: string; status: string }[] | null };

          if (!memberships || memberships.length === 0) {
            router.push("/register");
          } else {
            const hasActive = memberships.some((m: { id: string; status: string }) => m.status === "ACTIVE");
            if (hasActive) {
              router.push("/portal");
            } else {
              router.push("/pending-approval");
            }
          }
        }
      }
    } catch (err) {
      setError("Error inesperado. Intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
      </div>
            <span className="text-xl font-semibold tracking-tight">
              Converzia
            </span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Bienvenido de vuelta
          </h1>
            <p className="text-muted-foreground mt-2">
                Ingresá tus credenciales para continuar
              </p>
            </div>

          {/* Error alert */}
            {(error || authError) && (
              <Alert variant="error" className="mb-6">
                {error || (authError === "auth_failed" ? "Error de autenticación. Intentá de nuevo." : authError)}
              </Alert>
            )}

          {/* Google Sign In */}
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleGoogleSignIn}
              isLoading={isGoogleLoading}
            className="h-11 mb-6"
            >
              {!isGoogleLoading && <GoogleIcon className="h-5 w-5 mr-2" />}
              Continuar con Google
            </Button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
              </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-background text-muted-foreground uppercase tracking-wider">
                o
                </span>
              </div>
            </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              </div>

              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
              className="h-11 mt-2"
              >
              Ingresar
              </Button>
            </form>

        {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-8">
          ¿No tenés cuenta?{" "}
          <button
            onClick={handleGoogleSignIn}
              className="text-foreground hover:underline font-medium"
          >
              Registrate
          </button>
        </p>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-muted/30 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(var(--primary)/0.1),transparent_50%)]" />
          {/* Grid pattern */}
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/50" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md text-center px-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary mx-auto mb-8 shadow-2xl shadow-primary/25">
            <Zap className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Automatizá tu marketing con IA
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Converzia te ayuda a convertir más leads en clientes con conversaciones inteligentes y automatización de primer nivel.
        </p>
        </div>
      </div>
    </div>
  );
}
