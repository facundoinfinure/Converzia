"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter, CardSection } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { useTenant, useTenantMutations } from "@/lib/hooks/use-tenants";
import { updateTenantSchema, type UpdateTenantInput } from "@/lib/validations/tenant";
import { slugify } from "@/lib/utils";
import type { TenantPricing } from "@/types";

// Timezone options for Argentina
const timezoneOptions = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Argentina/Cordoba", label: "Córdoba (GMT-3)" },
  { value: "America/Argentina/Mendoza", label: "Mendoza (GMT-3)" },
];

// Charge model options
const chargeModelOptions = [
  { value: "PER_LEAD", label: "Por Lead" },
  { value: "PER_SALE", label: "Por Venta" },
];

// Default package structure
interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  discount_pct?: number;
  is_popular?: boolean;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditTenantPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { tenant, pricing, isLoading: loadingTenant, refetch } = useTenant(id);
  const { updateTenant, updatePricing, isLoading } = useTenantMutations();
  const [autoSlug, setAutoSlug] = useState(true);
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  // Pricing state
  const [pricingForm, setPricingForm] = useState({
    charge_model: "PER_LEAD" as "PER_LEAD" | "PER_SALE",
    cost_per_lead: 10,
    success_fee_percentage: 0,
    success_fee_flat: 0,
    low_credit_threshold: 10,
    auto_refund_duplicates: true,
    auto_refund_spam: true,
    packages: [] as CreditPackage[],
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<UpdateTenantInput>({
    resolver: zodResolver(updateTenantSchema),
  });

  const name = watch("name");

  // Load tenant data into form
  useEffect(() => {
    if (tenant) {
      reset({
        name: tenant.name,
        slug: tenant.slug,
        contact_email: tenant.contact_email || "",
        contact_phone: tenant.contact_phone || "",
        timezone: tenant.timezone || "America/Argentina/Buenos_Aires",
        default_score_threshold: tenant.default_score_threshold || 80,
        duplicate_window_days: tenant.duplicate_window_days || 90,
      });
    }
  }, [tenant, reset]);

  // Load pricing data into form
  useEffect(() => {
    if (pricing) {
      setPricingForm({
        charge_model: (pricing.charge_model === "SUBSCRIPTION" ? "PER_LEAD" : pricing.charge_model) || "PER_LEAD",
        cost_per_lead: pricing.cost_per_lead || 10,
        success_fee_percentage: (pricing as any).success_fee_percentage || 0,
        success_fee_flat: (pricing as any).success_fee_flat || 0,
        low_credit_threshold: pricing.low_credit_threshold || 10,
        auto_refund_duplicates: pricing.auto_refund_duplicates ?? true,
        auto_refund_spam: pricing.auto_refund_spam ?? true,
        packages: (pricing.packages as CreditPackage[]) || [],
      });
    }
  }, [pricing]);

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (autoSlug) {
      setValue("slug", slugify(newName));
    }
  };

  const onSubmit = async (data: UpdateTenantInput) => {
    try {
      await updateTenant(id, {
        ...data,
        contact_email: data.contact_email || undefined,
        contact_phone: data.contact_phone || undefined,
      });
      toast.success("Tenant actualizado correctamente");
      router.push(`/admin/tenants/${id}`);
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      const errorMessage = error?.message || "Error al actualizar el tenant";
      toast.error(errorMessage);
    }
  };

  // Save pricing
  const handleSavePricing = async () => {
    setIsSavingPricing(true);
    try {
      await updatePricing(id, pricingForm);
      toast.success("Pricing actualizado correctamente");
      refetch();
    } catch (error: any) {
      console.error("Error updating pricing:", error);
      toast.error(error?.message || "Error al actualizar el pricing");
    } finally {
      setIsSavingPricing(false);
    }
  };

  // Calculate package price based on CPL and discount
  const calculatePackagePrice = (credits: number, discountPct: number = 0, cpl: number) => {
    const basePrice = credits * cpl;
    const discount = discountPct / 100;
    return Math.round(basePrice * (1 - discount) * 100) / 100; // Round to 2 decimals
  };

  // Package management
  const addPackage = () => {
    const newId = `pkg_${Date.now()}`;
    const defaultCredits = 50;
    const defaultDiscount = 0;
    setPricingForm((prev) => ({
      ...prev,
      packages: [
        ...prev.packages,
        { 
          id: newId, 
          name: "", 
          credits: defaultCredits, 
          price: calculatePackagePrice(defaultCredits, defaultDiscount, prev.cost_per_lead),
        },
      ],
    }));
  };

  const updatePackage = (index: number, field: keyof CreditPackage, value: any) => {
    setPricingForm((prev) => {
      const updatedPackages = prev.packages.map((pkg, i) => {
        if (i !== index) return pkg;
        
        const updatedPkg = { ...pkg, [field]: value };
        
        // Recalculate price when credits or discount change
        if (field === "credits" || field === "discount_pct") {
          updatedPkg.price = calculatePackagePrice(
            field === "credits" ? value : pkg.credits,
            field === "discount_pct" ? (value || 0) : (pkg.discount_pct || 0),
            prev.cost_per_lead
          );
        }
        
        return updatedPkg;
      });
      
      return { ...prev, packages: updatedPackages };
    });
  };

  const removePackage = (index: number) => {
    setPricingForm((prev) => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index),
    }));
  };

  if (loadingTenant) {
    return (
      <PageContainer maxWidth="lg">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (!tenant) {
    return (
      <PageContainer maxWidth="lg">
        <Alert variant="error" title="Error">
          No se pudo cargar el tenant
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="Editar Tenant"
        description={`Editando: ${tenant.name}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Tenants", href: "/admin/tenants" },
          { label: tenant.name, href: `/admin/tenants/${id}` },
          { label: "Editar" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardContent className="p-6">
              <CardSection title="Información básica" description="Datos principales del tenant">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Nombre"
                    placeholder="Ej: Desarrollos Norte SA"
                    {...register("name")}
                    onChange={(e) => {
                      register("name").onChange(e);
                      handleNameChange(e);
                    }}
                    error={errors.name?.message}
                    required
                  />

                  <div>
                    <Input
                      label="Slug"
                      placeholder="ej: desarrollos-norte"
                      {...register("slug")}
                      onChange={(e) => {
                        register("slug").onChange(e);
                        setAutoSlug(false);
                      }}
                      error={errors.slug?.message}
                      hint="Se usa en URLs y referencias internas"
                      required
                    />
                  </div>

                  <Input
                    label="Email de contacto"
                    type="email"
                    placeholder="contacto@empresa.com"
                    {...register("contact_email")}
                    error={errors.contact_email?.message}
                  />

                  <Input
                    label="Teléfono de contacto"
                    placeholder="+54 11 1234-5678"
                    {...register("contact_phone")}
                    error={errors.contact_phone?.message}
                  />
                </div>
              </CardSection>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardContent className="p-6">
              <CardSection title="Configuración" description="Parámetros de calificación y duplicados">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Select
                    label="Zona horaria"
                    options={timezoneOptions}
                    {...register("timezone")}
                    error={errors.timezone?.message}
                  />

                  <Input
                    label="Score threshold"
                    type="number"
                    min={1}
                    max={100}
                    {...register("default_score_threshold", { valueAsNumber: true })}
                    error={errors.default_score_threshold?.message}
                    hint="Puntaje mínimo para Lead Ready"
                  />

                  <Input
                    label="Ventana duplicados (días)"
                    type="number"
                    min={1}
                    max={365}
                    {...register("duplicate_window_days", { valueAsNumber: true })}
                    error={errors.duplicate_window_days?.message}
                    hint="Días para considerar duplicado"
                  />
                </div>
              </CardSection>
            </CardContent>

            <CardFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/admin/tenants/${id}`)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>

      {/* Pricing Section - Separate form */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <CardSection title="Modelo de cobro" description="Configuración de pricing y paquetes de créditos">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Select
                label="Tipo de cobro"
                options={chargeModelOptions}
                value={pricingForm.charge_model}
                onChange={(e) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    charge_model: e.target.value as "PER_LEAD" | "PER_SALE" | "SUBSCRIPTION",
                  }))
                }
              />

              {/* PER_LEAD: Show cost per lead */}
              {pricingForm.charge_model === "PER_LEAD" && (
                <Input
                  label="Costo por lead (USD)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={pricingForm.cost_per_lead}
                  onChange={(e) => {
                    const newCpl = parseFloat(e.target.value) || 0;
                    setPricingForm((prev) => ({
                      ...prev,
                      cost_per_lead: newCpl,
                      // Recalculate all package prices with new CPL
                      packages: prev.packages.map((pkg) => ({
                        ...pkg,
                        price: calculatePackagePrice(pkg.credits, pkg.discount_pct || 0, newCpl),
                      })),
                    }));
                  }}
                />
              )}

              {/* PER_SALE: Show success fee fields */}
              {pricingForm.charge_model === "PER_SALE" && (
                <>
                  <Input
                    label="Comisión de éxito (%)"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={pricingForm.success_fee_percentage}
                    onChange={(e) =>
                      setPricingForm((prev) => ({
                        ...prev,
                        success_fee_percentage: parseFloat(e.target.value) || 0,
                      }))
                    }
                    hint="Porcentaje sobre el valor de la venta"
                  />
                  <Input
                    label="Fee fijo por venta (USD)"
                    type="number"
                    min={0}
                    step={0.01}
                    value={pricingForm.success_fee_flat}
                    onChange={(e) =>
                      setPricingForm((prev) => ({
                        ...prev,
                        success_fee_flat: parseFloat(e.target.value) || 0,
                      }))
                    }
                    hint="Monto fijo adicional por venta cerrada"
                  />
                </>
              )}

              <Input
                label="Umbral bajo de créditos"
                type="number"
                min={0}
                value={pricingForm.low_credit_threshold}
                onChange={(e) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    low_credit_threshold: parseInt(e.target.value) || 0,
                  }))
                }
                hint="Se mostrará alerta cuando baje de este nivel"
              />
            </div>

            <div className="flex items-center gap-8 mt-6">
              <Switch
                label="Auto-refund duplicados"
                checked={pricingForm.auto_refund_duplicates}
                onCheckedChange={(checked) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    auto_refund_duplicates: checked,
                  }))
                }
              />

              <Switch
                label="Auto-refund spam"
                checked={pricingForm.auto_refund_spam}
                onCheckedChange={(checked) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    auto_refund_spam: checked,
                  }))
                }
              />
            </div>
          </CardSection>

          {/* Credit Packages */}
          <CardSection
            title="Paquetes de créditos"
            description="Configurá los paquetes disponibles para compra"
            className="mt-8"
          >
            {pricingForm.packages.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                      <th className="pb-3 pr-4">Nombre</th>
                      <th className="pb-3 pr-4">Créditos</th>
                      <th className="pb-3 pr-4">Precio (USD)</th>
                      <th className="pb-3 pr-4">Descuento %</th>
                      <th className="pb-3 pr-4">Precio/Lead</th>
                      <th className="pb-3 pr-4 text-center">Popular</th>
                      <th className="pb-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {pricingForm.packages.map((pkg, index) => (
                      <tr key={pkg.id} className="group">
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => updatePackage(index, "name", e.target.value)}
                            placeholder="Nombre"
                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            min={1}
                            value={pkg.credits}
                            onChange={(e) => updatePackage(index, "credits", parseInt(e.target.value) || 0)}
                            className="w-24 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          {pricingForm.charge_model === "PER_LEAD" ? (
                            <span className="px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                              ${pkg.price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={pkg.price}
                              onChange={(e) => updatePackage(index, "price", parseFloat(e.target.value) || 0)}
                              className="w-28 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                            />
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={pkg.discount_pct || ""}
                            onChange={(e) => updatePackage(index, "discount_pct", e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-20 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <span className="px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">
                            ${pkg.credits > 0 ? (pkg.price / pkg.credits).toFixed(2) : "0.00"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <Switch
                            checked={pkg.is_popular || false}
                            onCheckedChange={(checked) => updatePackage(index, "is_popular", checked)}
                          />
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => removePackage(index)}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={addPackage}
              leftIcon={<Plus className="h-4 w-4" />}
              className={pricingForm.packages.length > 0 ? "mt-4" : ""}
            >
              Agregar paquete
            </Button>
          </CardSection>
        </CardContent>

        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/admin/tenants/${id}`)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSavePricing}
            isLoading={isSavingPricing}
          >
            Guardar Pricing
          </Button>
        </CardFooter>
      </Card>
    </PageContainer>
  );
}








