"use client";

import Link from "next/link";
import { ShieldX, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth/context";

export default function NoAccessPage() {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <ShieldX className="h-8 w-8 text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Sin acceso
          </h1>
          <p className="text-slate-400 mb-6">
            Tu cuenta no tiene acceso a ningún tenant activo. Si creés que esto es un error, contactá al administrador.
          </p>

          {profile?.email && (
            <p className="text-sm text-slate-500 mb-6">
              Sesión iniciada como: <span className="text-slate-300">{profile.email}</span>
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => signOut()}
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              Cerrar sesión
            </Button>
            <Link href="/">
              <Button
                variant="ghost"
                fullWidth
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Volver al inicio
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}








