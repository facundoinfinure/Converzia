"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

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
          router.push("/portal");
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

            {error && (
              <Alert variant="error" className="mb-6">
                {error}
              </Alert>
            )}

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
          <Link
            href="/register"
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            Contactanos
          </Link>
        </p>
      </div>
    </div>
  );
}

