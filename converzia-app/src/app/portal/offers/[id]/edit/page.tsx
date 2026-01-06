"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter, CardSection } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { useOffer, useOfferMutations } from "@/lib/hooks/use-offers";
import { updateOfferSchema, type UpdateOfferInput } from "@/lib/validations/offer";
import { slugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

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

interface Props {
  params: Promise<{ id: string }>;
}

export default function PortalEditOfferPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { activeTenantId, hasPermission } = useAuth();
  const { offer, isLoading: loadingOffer, refetch } = useOffer(id);
  const { updateOffer, isLoading } = useOfferMutations();
  const [autoSlug, setAutoSlug] = useState(true);
  const supabase = createClient();

  const canManageOffers = hasPermission?.('offers:manage') ?? false;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<UpdateOfferInput>({
    resolver: zodResolver(updateOfferSchema),
  });

  const name = watch("name");

  // Verify offer belongs to tenant and user has permissions
  useEffect(() => {
    async function verifyAccess() {
      if (!offer || !activeTenantId) return;
      
      if (offer.tenant_id !== activeTenantId) {
        toast.error("No tenés acceso a este proyecto");
        router.push("/portal/offers");
        return;
      }

      if (!canManageOffers) {
        toast.error("No tenés permisos para editar proyectos");
        router.push(`/portal/offers/${id}`);
        return;
      }
    }

    verifyAccess();
  }, [offer, activeTenantId, canManageOffers, id, router, toast]);

  // Load offer data into form
  useEffect(() => {
    if (offer) {
      reset({
        name: offer.name,
        slug: offer.slug,
        offer_type: offer.offer_type,
        status: offer.status,
        description: offer.description || "",
        short_description: offer.short_description || "",
        image_url: offer.image_url || "",
        country: offer.country || "AR",
        city: offer.city || "",
        zone: offer.zone || "",
        address: offer.address || "",
        latitude: offer.latitude || undefined,
        longitude: offer.longitude || undefined,
        currency: offer.currency || "USD",
        price_from: offer.price_from || undefined,
        price_to: offer.price_to || undefined,
        priority: offer.priority || 100,
      });
    }
  }, [offer, reset]);

  // Auto-generate slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoSlug) {
      setValue("slug", slugify(e.target.value));
    }
  };

  const onSubmit = async (data: UpdateOfferInput) => {
    if (!canManageOffers) {
      toast.error("No tenés permisos para editar proyectos");
      return;
    }

    try {
      await updateOffer(id, {
        ...data,
        description: data.description || null,
        short_description: data.short_description || null,
        image_url: data.image_url || null,
        address: data.address || null,
        city: data.city || null,
        zone: data.zone || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        price_from: data.price_from || null,
        price_to: data.price_to || null,
      });
      toast.success("Proyecto actualizado correctamente");
      router.push(`/portal/offers/${id}`);
    } catch (error: any) {
      console.error("Error updating offer:", error);
      toast.error(error?.message || "Error al actualizar el proyecto");
    }
  };

  if (loadingOffer) {
    return (
      <PageContainer maxWidth="xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (!offer) {
    return (
      <PageContainer maxWidth="xl">
        <Alert variant="error" title="Error">
          No se pudo cargar el proyecto
        </Alert>
      </PageContainer>
    );
  }

  if (!canManageOffers) {
    return (
      <PageContainer maxWidth="xl">
        <Alert variant="error" title="Sin permisos">
          No tenés permisos para editar proyectos
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title="Editar Proyecto"
        description={`Editando: ${offer.name}`}
        breadcrumbs={[
          { label: "Portal", href: "/portal" },
          { label: "Mis Proyectos", href: "/portal/offers" },
          { label: offer.name, href: `/portal/offers/${id}` },
          { label: "Editar" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardContent className="p-6">
              <CardSection title="Información básica">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select
                    label="Tipo de oferta"
                    options={offerTypeOptions}
                    {...register("offer_type")}
                    error={errors.offer_type?.message}
                    required
                  />

                  <Select
                    label="Estado"
                    options={[
                      { value: "DRAFT", label: "Borrador" },
                      { value: "ACTIVE", label: "Activo" },
                      { value: "PAUSED", label: "Pausado" },
                      { value: "ARCHIVED", label: "Archivado" },
                    ]}
                    {...register("status")}
                    error={errors.status?.message}
                  />

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

                  <Input
                    label="Slug"
                    placeholder="ej: torre-central"
                    {...register("slug")}
                    onChange={(e) => {
                      register("slug").onChange(e);
                      setAutoSlug(false);
                    }}
                    error={errors.slug?.message}
                    hint="Se usa en URLs"
                    required
                  />

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
                      rows={4}
                      {...register("description")}
                      error={errors.description?.message}
                    />
                  </div>

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
                    hint="Mayor = más prioridad (0-1000)"
                  />
                </div>
              </CardSection>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardContent className="p-6">
              <CardSection title="Ubicación">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Select
                    label="País"
                    options={countryOptions}
                    {...register("country")}
                    error={errors.country?.message}
                  />

                  <Input
                    label="Ciudad"
                    placeholder="Buenos Aires"
                    {...register("city")}
                    error={errors.city?.message}
                  />

                  <Input
                    label="Zona / Barrio"
                    placeholder="Palermo"
                    {...register("zone")}
                    error={errors.zone?.message}
                  />

                  <div className="md:col-span-3">
                    <Input
                      label="Dirección"
                      placeholder="Av. Libertador 1234"
                      {...register("address")}
                      error={errors.address?.message}
                    />
                  </div>

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
              </CardSection>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardContent className="p-6">
              <CardSection title="Precios">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Select
                    label="Moneda"
                    options={currencyOptions}
                    {...register("currency")}
                    error={errors.currency?.message}
                  />

                  <Input
                    label="Precio desde"
                    type="number"
                    min={0}
                    placeholder="100000"
                    {...register("price_from", { valueAsNumber: true })}
                    error={errors.price_from?.message}
                  />

                  <Input
                    label="Precio hasta"
                    type="number"
                    min={0}
                    placeholder="200000"
                    {...register("price_to", { valueAsNumber: true })}
                    error={errors.price_to?.message}
                  />
                </div>
              </CardSection>
            </CardContent>

            <CardFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/portal/offers/${id}`)}
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
    </PageContainer>
  );
}
