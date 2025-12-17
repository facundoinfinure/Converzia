"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter, CardSection } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select, CustomSelect } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useOfferMutations, useTenantOptions } from "@/lib/hooks/use-offers";
import { createOfferSchema, type CreateOfferInput } from "@/lib/validations/offer";
import { slugify } from "@/lib/utils";

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
];

const countryOptions = [
  { value: "AR", label: "Argentina" },
  { value: "UY", label: "Uruguay" },
  { value: "CL", label: "Chile" },
  { value: "MX", label: "México" },
];

export default function NewOfferPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { createOffer, isLoading } = useOfferMutations();
  const { options: tenantOptions, isLoading: loadingTenants } = useTenantOptions();
  const [autoSlug, setAutoSlug] = useState(true);

  const defaultTenantId = searchParams.get("tenant") || "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateOfferInput>({
    resolver: zodResolver(createOfferSchema),
    defaultValues: {
      tenant_id: defaultTenantId,
      offer_type: "PROPERTY",
      status: "DRAFT",
      country: "AR",
      currency: "USD",
      priority: 100,
    },
  });

  const name = watch("name");
  const selectedTenantId = watch("tenant_id");

  // Auto-generate slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoSlug) {
      setValue("slug", slugify(e.target.value));
    }
  };

  const onSubmit = async (data: CreateOfferInput) => {
    try {
      const offer = await createOffer({
        ...data,
        offer_type: data.offer_type || "PROPERTY",
        status: data.status || "DRAFT",
        country: data.country || "AR",
        currency: data.currency || "USD",
        priority: data.priority || 100,
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
      toast.success("Oferta creada correctamente");
      router.push(`/admin/offers/${(offer as any).id}`);
    } catch (error) {
      toast.error("Error al crear la oferta");
    }
  };

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title="Nueva Oferta"
        description="Crear una nueva oferta en la plataforma"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Ofertas", href: "/admin/offers" },
          { label: "Nueva" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardContent className="p-6">
              <CardSection title="Información básica">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CustomSelect
                    label="Tenant"
                    value={selectedTenantId}
                    onChange={(val) => setValue("tenant_id", val)}
                    options={tenantOptions}
                    placeholder="Seleccionar tenant"
                    error={errors.tenant_id?.message}
                    required
                    disabled={loadingTenants}
                  />

                  <Select
                    label="Tipo de oferta"
                    options={offerTypeOptions}
                    {...register("offer_type")}
                    error={errors.offer_type?.message}
                    required
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
                onClick={() => router.push("/admin/offers")}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Crear Oferta
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </PageContainer>
  );
}

