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
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--accent-primary)]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[var(--accent-primary)]/5 to-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fadeInUp">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-purple-600 shadow-xl shadow-[var(--accent-primary)]/30">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] font-[var(--font-display)]">
            Converzia
          </h1>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-[var(--border-primary)]">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-[var(--font-display)]">
                Iniciar sesión
              </h2>
              <p className="text-[var(--text-secondary)] mt-2 text-sm sm:text-base">
                Ingresá tus credenciales para continuar
              </p>
            </div>

            {(error || authError) && (
              <Alert variant="error" className="mb-6">
                {error || (authError === "auth_failed" ? "Error de autenticación. Intentá de nuevo." : authError)}
              </Alert>
            )}

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="lg"
              onClick={handleGoogleSignIn}
              isLoading={isGoogleLoading}
              className="mb-6"
            >
              {!isGoogleLoading && <GoogleIcon className="h-5 w-5 mr-2" />}
              Continuar con Google
            </Button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-primary)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[var(--bg-primary)] text-[var(--text-tertiary)] font-medium">
                  o con email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-5 w-5" />}
                autoComplete="email"
                required
              />

              <Input
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-5 w-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                }
                autoComplete="current-password"
                required
              />

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] focus:ring-offset-0"
                  />
                  <span>Recordarme</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isLoading}
              >
                Iniciar sesión
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-[var(--text-tertiary)] mt-6">
          ¿No tenés cuenta?{" "}
          <button
            onClick={handleGoogleSignIn}
            className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors font-semibold"
          >
            Registrate con Google
          </button>
        </p>

        {/* Branding footer */}
        <p className="text-center text-xs text-[var(--text-tertiary)] mt-8 opacity-60">
          © 2024 Converzia. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
