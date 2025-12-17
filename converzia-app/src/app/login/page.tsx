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
      // If successful, user will be redirected to Google
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Email o contraseña incorrectos");
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (data.user) {
        // Check if user is admin
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_converzia_admin")
          .eq("id", data.user.id)
          .single();

        if ((profile as any)?.is_converzia_admin) {
          router.push("/admin");
        } else {
          // Check for active memberships
          const { data: memberships } = await supabase
            .from("tenant_members")
            .select("id, status")
            .eq("user_id", data.user.id);

          if (!memberships || memberships.length === 0) {
            router.push("/register");
          } else {
            const hasActive = memberships.some((m) => m.status === "ACTIVE");
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Converzia</h1>
        </div>

        {/* Login Card */}
        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-white mb-2">
                Iniciar sesión
              </h2>
              <p className="text-slate-400">
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
                <div className="w-full border-t border-card-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card text-slate-500">o con email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                required
              />

              <Input
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
                autoComplete="current-password"
                required
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    className="rounded border-card-border bg-card text-primary-500 focus:ring-primary-500"
                  />
                  Recordarme
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
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
        <p className="text-center text-sm text-slate-500 mt-6">
          ¿No tenés cuenta?{" "}
          <button
            onClick={handleGoogleSignIn}
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            Registrate con Google
          </button>
        </p>
      </div>
    </div>
  );
}
