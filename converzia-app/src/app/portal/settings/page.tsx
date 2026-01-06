"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Building2,
  CreditCard,
  DollarSign,
  Gift,
  Mail,
  Phone,
  Image as ImageIcon,
  Info,
  Save,
  Upload,
  X,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatCurrency } from "@/lib/utils";

interface TenantData {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  trial_credits_amount: number | null;
  trial_granted_at: string | null;
  logo_url: string | null;
}

interface TenantPricingData {
  charge_model: "PER_LEAD" | "PER_SALE";
  cost_per_lead: number;
  currency: string;
  default_trial_credits: number;
  packages: Array<{
    id: string;
    name: string;
    credits: number;
    price: number;
    discount_pct?: number;
  }>;
}

export default function PortalSettingsPage() {
  const { activeTenantId, activeTenant, hasPermission } = useAuth();
  const toast = useToast();
  const supabase = createClient();

  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [pricingData, setPricingData] = useState<TenantPricingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Form state (only editable fields for tenants)
  const [formData, setFormData] = useState({
    contact_email: "",
    contact_phone: "",
  });

  const canEdit = hasPermission?.("settings:manage") ?? false;

  // Load tenant and pricing data
  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadData = useCallback(async () => {
    if (!activeTenantId) return;
    setIsLoading(true);

    try {
      // Load tenant data
      const { data: tenant, error: tenantError } = await queryWithTimeout(
        supabase
          .from("tenants")
          .select("id, name, contact_email, contact_phone, trial_credits_amount, trial_granted_at, logo_url, settings")
          .eq("id", activeTenantId)
          .single(),
        10000,
        "load tenant"
      );

      if (tenantError) {
        console.error("Error loading tenant:", tenantError);
        toast.error("Error al cargar datos del tenant");
      } else if (tenant) {
        const tenantTyped = tenant as any;
        // Get logo_url from column or settings JSONB
        const logoUrl = tenantTyped.logo_url || (tenantTyped.settings as any)?.logo_url || null;
        
        setTenantData({
          ...tenantTyped,
          logo_url: logoUrl,
        });
        setLogoPreview(logoUrl);
        setFormData({
          contact_email: tenantTyped.contact_email || "",
          contact_phone: tenantTyped.contact_phone || "",
        });
      }

      // Load pricing data
      const { data: pricing, error: pricingError } = await queryWithTimeout(
        supabase
          .from("tenant_pricing")
          .select("charge_model, cost_per_lead, currency, default_trial_credits, packages")
          .eq("tenant_id", activeTenantId)
          .single(),
        10000,
        "load pricing"
      );

      if (pricingError && pricingError.code !== "PGRST116") {
        // PGRST116 = no rows returned, which is OK
        console.error("Error loading pricing:", pricingError);
      } else if (pricing) {
        setPricingData(pricing as TenantPricingData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }, [activeTenantId, supabase, toast]);

  const handleSave = async () => {
    if (!activeTenantId || !canEdit) {
      toast.error("No tenés permisos para editar esta información");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await queryWithTimeout(
        supabase
          .from("tenants")
          .update({
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeTenantId),
        10000,
        "update tenant"
      );

      if (error) throw error;

      toast.success("Datos actualizados correctamente");
      await loadData();
    } catch (error: any) {
      console.error("Error saving:", error);
      toast.error(error?.message || "Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Tipo de archivo no permitido. Solo se permiten JPG, PNG o WebP");
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. Tamaño máximo: 2MB");
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/portal/settings/upload-logo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error al subir el logo");
      }

      toast.success("Logo actualizado correctamente");
      await loadData();
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(error?.message || "Error al subir el logo");
      setLogoPreview(tenantData?.logo_url || null);
    } finally {
      setIsUploadingLogo(false);
      // Reset input
      event.target.value = "";
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  const chargeModelLabel = pricingData?.charge_model === "PER_LEAD" ? "Por Lead" : "Por Venta";

  return (
    <PageContainer>
      <PageHeader
        title="Configuración"
        description="Gestiona la configuración de tu cuenta y facturación"
        breadcrumbs={[
          { label: "Portal", href: "/portal" },
          { label: "Configuración" },
        ]}
      />

      <div className="space-y-6">
        {/* Información de la empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--text-secondary)]" />
              Información de la empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Upload Section */}
            <div className="pb-4 border-b border-[var(--border-primary)]">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                Logo de la empresa
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {logoPreview ? (
                    <div className="relative group">
                      <Image
                        src={logoPreview}
                        alt="Logo"
                        width={96}
                        height={96}
                        className="h-24 w-24 rounded-lg object-cover border border-[var(--border-primary)]"
                      />
                      {canEdit && (
                        <button
                          onClick={() => {
                            setLogoPreview(null);
                            // TODO: Add API call to delete logo
                          }}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[var(--error)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-[var(--text-tertiary)]" />
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex-1">
                    <label className="block">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                        className="hidden"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Upload className="h-4 w-4" />}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/jpeg,image/png,image/webp";
                          input.onchange = (e) => {
                            const event = e as any;
                            handleLogoUpload(event);
                          };
                          input.click();
                        }}
                        isLoading={isUploadingLogo}
                      >
                        {logoPreview ? "Cambiar logo" : "Subir logo"}
                      </Button>
                    </label>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      JPG, PNG o WebP. Máximo 2MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Nombre de la empresa
                </label>
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                  <p className="text-[var(--text-primary)]">{tenantData?.name || activeTenant?.name || "-"}</p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">No editable</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Email de contacto
                </label>
                {canEdit ? (
                  <Input
                    type="email"
                    placeholder="contacto@empresa.com"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                ) : (
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                    <p className="text-[var(--text-primary)]">{formData.contact_email || "-"}</p>
                  </div>
                )}
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Usado para facturación y notificaciones
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Teléfono de contacto
                </label>
                {canEdit ? (
                  <Input
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                ) : (
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                    <p className="text-[var(--text-primary)]">{formData.contact_phone || "-"}</p>
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end pt-4 border-t border-[var(--border-primary)]">
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Guardar cambios
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuración de facturación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[var(--text-secondary)]" />
              Configuración de facturación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Tipo de pago
                </label>
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                  <p className="text-[var(--text-primary)]">{chargeModelLabel}</p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {pricingData?.charge_model === "PER_LEAD" 
                    ? "Se cobra por cada lead calificado entregado"
                    : "Se cobra cuando se cierra una venta"}
                </p>
              </div>

              {pricingData?.charge_model === "PER_LEAD" && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Costo por lead
                  </label>
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                    <p className="text-[var(--text-primary)]">
                      {formatCurrency(pricingData.cost_per_lead || 0, pricingData.currency || "USD")}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Leads de prueba otorgados
                </label>
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                  <p className="text-[var(--text-primary)]">
                    {tenantData?.trial_credits_amount || 0} créditos
                  </p>
                </div>
                {tenantData?.trial_granted_at && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Otorgados el {new Date(tenantData.trial_granted_at).toLocaleDateString("es-AR")}
                  </p>
                )}
              </div>
            </div>

            {/* Packages */}
            {pricingData && pricingData.packages && pricingData.packages.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                  Paquetes de créditos disponibles
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {pricingData.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-[var(--text-primary)]">{pkg.name}</p>
                        {pkg.discount_pct && (
                          <span className="text-xs text-[var(--accent-primary)]">
                            {pkg.discount_pct}% desc.
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                        {pkg.credits} créditos
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {formatCurrency(pkg.price, pricingData.currency || "USD")}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {new Intl.NumberFormat("es-AR", {
                          style: "currency",
                          currency: pricingData.currency || "USD",
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(pkg.price / pkg.credits)} por crédito
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 p-4 rounded-lg bg-[var(--info-light)]/20 border border-[var(--info)]/30">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-[var(--info)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="h-3 w-3 text-[var(--info)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Para modificar el tipo de pago, pricing o paquetes, contactá a tu administrador de Converzia.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
