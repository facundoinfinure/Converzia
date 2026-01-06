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
  
  // Form state (only editable fields for tenants)
  const [formData, setFormData] = useState({
    contact_email: "",
    contact_phone: "",
  });

  const canEdit = hasPermission?.("settings:manage") ?? false;

  // Load tenant and pricing data
  useEffect(() => {
    loadData();
  }, [activeTenantId]);

  const loadData = useCallback(async () => {
    if (!activeTenantId) return;
    setIsLoading(true);

    try {
      // Load tenant data
      const { data: tenant, error: tenantError } = await queryWithTimeout(
        supabase
          .from("tenants")
          .select("id, name, contact_email, contact_phone, trial_credits_amount, trial_granted_at")
          .eq("id", activeTenantId)
          .single(),
        10000,
        "load tenant"
      );

      if (tenantError) {
        console.error("Error loading tenant:", tenantError);
        toast.error("Error al cargar datos del tenant");
      } else if (tenant) {
        setTenantData(tenant as TenantData);
        setFormData({
          contact_email: tenant.contact_email || "",
          contact_phone: tenant.contact_phone || "",
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

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Leads de prueba por defecto
                </label>
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                  <p className="text-[var(--text-primary)]">
                    {pricingData?.default_trial_credits || 0} créditos
                  </p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Créditos otorgados a nuevos usuarios
                </p>
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

            <Alert variant="info" className="mt-4">
              <Info className="h-4 w-4" />
              <p className="text-sm">
                Para modificar el tipo de pago, pricing o paquetes, contactá a tu administrador de Converzia.
              </p>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
