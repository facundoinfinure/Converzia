"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter, CardSection } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { useOfferMutations } from "@/lib/hooks/use-offers";
import { createOfferSchema, type CreateOfferInput } from "@/lib/validations/offer";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Options
const offerTypeOptions = [
  { value: "PROPERTY", label: "Inmueble" },
  { value: "AUTO", label: "Auto" },
  { value: "LOAN", label: "Préstamo" },
  { value: "INSURANCE", label: "Seguro" },
];

const currencyOptions = [
  { value: "USD", label: "USD" },
  { value: "ARS", label: "ARS" },
  { value: "EUR", label: "EUR" },
];

const countryOptions = [
  { value: "AR", label: "Argentina" },
  { value: "UY", label: "Uruguay" },
  { value: "CL", label: "Chile" },
  { value: "MX", label: "México" },
];

export default function PortalNewOfferPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeTenantId, hasPermission } = useAuth();
  const { createOffer, isLoading } = useOfferMutations();
  const [autoSlug, setAutoSlug] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canManageOffers = hasPermission?.('offers:manage') ?? false;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateOfferInput>({
    resolver: zodResolver(createOfferSchema),
    defaultValues: {
      tenant_id: activeTenantId || "",
      offer_type: "PROPERTY",
      status: "DRAFT",
      country: "AR",
      currency: "USD",
      priority: 100,
    },
  });

  const name = watch("name");

  // Set tenant_id when activeTenantId is available
  useEffect(() => {
    if (activeTenantId) {
      setValue("tenant_id", activeTenantId);
    }
  }, [activeTenantId, setValue]);

  // Auto-generate slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoSlug) {
      setValue("slug", slugify(e.target.value));
    }
  };

  const onSubmit = async (data: CreateOfferInput) => {
    if (!canManageOffers) {
      toast.error("No tenés permisos para crear proyectos");
      return;
    }

    if (!activeTenantId) {
      toast.error("No se pudo identificar tu tenant");
      return;
    }

    try {
      // Prepare data - convert empty strings to null/undefined
      const offerData: any = {
        tenant_id: activeTenantId,
        name: data.name,
        slug: data.slug,
        offer_type: data.offer_type || "PROPERTY",
        status: data.status || "DRAFT",
        country: data.country || "AR",
        currency: data.currency || "USD",
        priority: data.priority || 100,
        description: data.description && data.description.trim() ? data.description.trim() : null,
        short_description: data.short_description && data.short_description.trim() ? data.short_description.trim() : null,
        image_url: data.image_url && data.image_url.trim() ? data.image_url.trim() : null,
        address: data.address && data.address.trim() ? data.address.trim() : null,
        city: data.city && data.city.trim() ? data.city.trim() : null,
        zone: data.zone && data.zone.trim() ? data.zone.trim() : null,
        latitude: data.latitude !== undefined && data.latitude !== null && !isNaN(Number(data.latitude)) ? Number(data.latitude) : null,
        longitude: data.longitude !== undefined && data.longitude !== null && !isNaN(Number(data.longitude)) ? Number(data.longitude) : null,
        price_from: data.price_from !== undefined && data.price_from !== null && !isNaN(Number(data.price_from)) ? Number(data.price_from) : null,
        price_to: data.price_to !== undefined && data.price_to !== null && !isNaN(Number(data.price_to)) ? Number(data.price_to) : null,
      };

      const offer = await createOffer(offerData);
      
      toast.success("Proyecto creado correctamente");
      router.push(`/portal/offers/${(offer as any).id}`);
    } catch (error: any) {
      console.error("Error creating offer:", error);
      const errorMessage = error?.message || "Error al crear el proyecto";
      toast.error(errorMessage);
    }
  };

  if (!canManageOffers) {
    return (
      <PageContainer maxWidth="xl">
        <Alert variant="error" title="Sin permisos">
          No tenés permisos para crear proyectos
        </Alert>
      </PageContainer>
    );
  }

  if (!activeTenantId) {
    return (
      <PageContainer maxWidth="xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title="Nuevo Proyecto"
        description="Crear un nuevo proyecto inmobiliario"
        breadcrumbs={[
          { label: "Portal", href: "/portal" },
          { label: "Mis Proyectos", href: "/portal/offers" },
          { label: "Nuevo" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit, (errors) => {
        console.error("Form validation errors:", errors);
        toast.error("Por favor, completá todos los campos requeridos correctamente");
      })}>
        <div className="space-y-6">
          {/* Essential Fields */}
          <Card>
            <CardContent className="p-6">
              <CardSection title="Datos esenciales">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select
                    label="Tipo"
                    options={offerTypeOptions}
                    {...register("offer_type")}
                    error={errors.offer_type?.message}
                    required
                  />

                  <div className="md:col-span-2">
                    <Input
                      label="Nombre"
                      placeholder="Ej: Torre Central"
                      {...register("name")}
                      onChange={(e) => {
                        register("name").onChange(e);
                        handleNameChange(e);
                      }}
                      error={errors.name?.message}
                      required
                    />
                  </div>

                  <Input
                    label="Ciudad"
                    placeholder="Buenos Aires"
                    {...register("city")}
                    error={errors.city?.message}
                  />

                  <Input
                    label="Precio desde (USD)"
                    type="number"
                    min={0}
                    placeholder="100000"
                    {...register("price_from", { valueAsNumber: true })}
                    error={errors.price_from?.message}
                  />
                </div>
              </CardSection>

              {/* Advanced Fields - Collapsable */}
              <div className="mt-6 pt-6 border-t border-[var(--border-primary)]">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Configuración avanzada
                </button>

                <div className={cn(
                  "overflow-hidden transition-all duration-300",
                  showAdvanced ? "mt-6 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                )}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Hidden slug field - auto-generated */}
                    <input type="hidden" {...register("slug")} />
                    
                    <div className="md:col-span-2">
                      <Input
                        label="Descripción corta"
                        placeholder="Breve descripción para previews"
                        {...register("short_description")}
                        error={errors.short_description?.message}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <TextArea
                        label="Descripción completa"
                        placeholder="Descripción detallada del proyecto..."
                        rows={3}
                        {...register("description")}
                        error={errors.description?.message}
                      />
                    </div>

                    <Select
                      label="País"
                      options={countryOptions}
                      {...register("country")}
                      error={errors.country?.message}
                    />

                    <Input
                      label="Zona / Barrio"
                      placeholder="Palermo"
                      {...register("zone")}
                      error={errors.zone?.message}
                    />

                    <div className="md:col-span-2">
                      <Input
                        label="Dirección"
                        placeholder="Av. Libertador 1234"
                        {...register("address")}
                        error={errors.address?.message}
                      />
                    </div>

                    <Select
                      label="Moneda"
                      options={currencyOptions}
                      {...register("currency")}
                      error={errors.currency?.message}
                    />

                    <Input
                      label="Precio hasta"
                      type="number"
                      min={0}
                      placeholder="200000"
                      {...register("price_to", { valueAsNumber: true })}
                      error={errors.price_to?.message}
                    />

                    <Input
                      label="URL de imagen"
                      placeholder="https://..."
                      {...register("image_url")}
                      error={errors.image_url?.message}
                    />

                    <Input
                      label="Prioridad"
                      type="number"
                      min={0}
                      max={1000}
                      {...register("priority", { valueAsNumber: true })}
                      error={errors.priority?.message}
                      hint="Mayor = más prioridad (default: 100)"
                    />

                    <Input
                      label="Latitud"
                      type="number"
                      step="any"
                      placeholder="-34.6037"
                      {...register("latitude", { valueAsNumber: true })}
                      error={errors.latitude?.message}
                    />

                    <Input
                      label="Longitud"
                      type="number"
                      step="any"
                      placeholder="-58.3816"
                      {...register("longitude", { valueAsNumber: true })}
                      error={errors.longitude?.message}
                    />
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/portal/offers")}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Crear Proyecto
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </PageContainer>
  );
}
