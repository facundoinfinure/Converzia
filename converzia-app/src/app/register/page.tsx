"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Building2, Phone, Globe, FileText, Briefcase, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { CustomSelect } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useAuth } from "@/lib/auth/context";

const VERTICAL_OPTIONS = [
  { value: "PROPERTY", label: "Inmobiliaria / Real Estate" },
  { value: "AUTO", label: "Automotriz" },
  { value: "LOAN", label: "Créditos / Préstamos" },
  { value: "INSURANCE", label: "Seguros" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    businessName: "",
    phone: "",
    vertical: "PROPERTY",
    website: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has a tenant
  useEffect(() => {
    const checkExistingTenant = async () => {
      if (!user) return;

      const { data: memberships } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .select("id, status, tenant:tenants(status)")
          .eq("user_id", user.id),
        10000,
        "check existing tenant memberships"
      );

      if (memberships && (memberships as any[]).length > 0) {
        // User already has a tenant - redirect appropriately
        const hasActive = (memberships as any[]).some(
          (m: any) => m.status === "ACTIVE" && m.tenant?.status === "ACTIVE"
        );
        if (hasActive) {
          router.push("/portal");
        } else {
          router.push("/pending-approval");
        }
      }
    };

    if (!authLoading && user) {
      checkExistingTenant();
    }
  }, [user, authLoading, router, supabase]);

  // If not logged in, redirect to login with Google
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!user) {
        setError("Debés iniciar sesión primero");
        setIsSubmitting(false);
        return;
      }

      // Validate required fields
      if (!formData.businessName.trim()) {
        setError("El nombre del negocio es requerido");
        setIsSubmitting(false);
        return;
      }

      if (!formData.phone.trim()) {
        setError("El teléfono de contacto es requerido");
        setIsSubmitting(false);
        return;
      }

      const slug = generateSlug(formData.businessName);

      // Use the register_tenant function to create tenant and membership
      // RPC calls need manual timeout handling
      const rpcPromise = supabase.rpc("register_tenant", {
        p_name: formData.businessName.trim(),
        p_slug: slug,
        p_contact_email: user.email || profile?.email || "",
        p_contact_phone: formData.phone.trim(),
        p_website: formData.website.trim() || null,
        p_description: formData.description.trim() || null,
        p_vertical: formData.vertical,
      });

      const { error: registerError } = await rpcPromise;

      if (registerError) {
        console.error("Error registering tenant:", registerError);
        
        // Handle specific error messages
        if (registerError.message.includes("already has a tenant")) {
          setError("Ya tenés un negocio registrado. Contactá soporte si necesitás ayuda.");
        } else if (registerError.message.includes("slug already exists")) {
          setError("Ya existe un negocio con un nombre similar. Probá con otro nombre.");
        } else {
          setError("Error al registrar el negocio. Intentá de nuevo.");
        }
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to pending approval page
      router.push("/pending-approval");
    } catch (err) {
      console.error("Registration error:", err);
      setError("Error inesperado. Intentá de nuevo.");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Converzia</h1>
        </div>

        {/* Register Card */}
        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-white mb-2">
                Registrá tu negocio
              </h2>
              <p className="text-slate-400">
                Completá los datos para solicitar acceso a la plataforma
              </p>
            </div>

            {profile?.email && (
              <div className="mb-6 p-3 rounded-lg bg-card-border/50 text-sm text-slate-400">
                Registrando como: <span className="text-white">{profile.email}</span>
              </div>
            )}

            {error && (
              <Alert variant="error" className="mb-6">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Nombre del negocio"
                type="text"
                placeholder="Mi Inmobiliaria"
                value={formData.businessName}
                onChange={(e) => handleChange("businessName", e.target.value)}
                leftIcon={<Building2 className="h-4 w-4" />}
                required
              />

              <Input
                label="Teléfono de contacto"
                type="tel"
                placeholder="+54 11 1234-5678"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                leftIcon={<Phone className="h-4 w-4" />}
                required
              />

              <CustomSelect
                label="Rubro / Vertical"
                value={formData.vertical}
                onChange={(value) => handleChange("vertical", value)}
                options={VERTICAL_OPTIONS}
              />

              <Input
                label="Sitio web (opcional)"
                type="url"
                placeholder="https://miempresa.com"
                value={formData.website}
                onChange={(e) => handleChange("website", e.target.value)}
                leftIcon={<Globe className="h-4 w-4" />}
              />

              <TextArea
                label="Descripción breve (opcional)"
                placeholder="Contanos brevemente sobre tu negocio..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={isSubmitting}
                >
                  Enviar solicitud
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-card-border">
              <p className="text-center text-sm text-slate-500">
                Una vez enviada tu solicitud, nuestro equipo la revisará y te contactaremos a la brevedad.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}






