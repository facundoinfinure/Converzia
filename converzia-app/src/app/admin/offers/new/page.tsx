"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

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
  const offerType = watch("offer_type");

  // Auto-generate slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoSlug) {
      setValue("slug", slugify(e.target.value));
    }
  };

  // Generate offer with AI
  const handleGenerateWithAI = async () => {
    if (!selectedTenantId || !offerType || !name) {
      toast.error("Completá tenant, tipo de oferta y nombre antes de generar con AI");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const response = await fetch("/api/offers/generate-ai", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          tenant_id: selectedTenantId,
          offer_type: offerType,
          name: name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error al generar con AI");
      }

      // Llenar los campos con los datos generados
      if (result.data.short_description) {
        setValue("short_description", result.data.short_description);
      }
      if (result.data.description) {
        setValue("description", result.data.description);
      }
      if (result.data.city) {
        setValue("city", result.data.city);
      }
      if (result.data.zone) {
        setValue("zone", result.data.zone);
      }
      if (result.data.address) {
        setValue("address", result.data.address);
      }
      if (result.data.price_from) {
        setValue("price_from", result.data.price_from);
      }
      if (result.data.price_to) {
        setValue("price_to", result.data.price_to);
      }
      if (result.data.currency) {
        setValue("currency", result.data.currency);
      }

      toast.success(
        `Oferta generada con AI usando ${result.data.rag_sources_used} fuente(s) del RAG`
      );
    } catch (error: any) {
      console.error("Error generating with AI:", error);
      toast.error(error?.message || "Error al generar la oferta con AI");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const onSubmit = async (data: CreateOfferInput) => {
    try {
      console.log("Form submitted with data:", data);
      
      // Prepare data - convert empty strings to null/undefined
      const offerData: any = {
        tenant_id: data.tenant_id,
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
        latitude: data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null,
        longitude: data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null,
        price_from: data.price_from !== undefined && data.price_from !== null ? Number(data.price_from) : null,
        price_to: data.price_to !== undefined && data.price_to !== null ? Number(data.price_to) : null,
      };

      console.log("Sending offer data:", offerData);
      const offer = await createOffer(offerData);
      console.log("Offer created successfully:", offer);
      
      toast.success("Oferta creada correctamente");
      router.push(`/admin/offers/${(offer as any).id}`);
    } catch (error: any) {
      console.error("Error creating offer:", error);
      const errorMessage = error?.message || "Error al crear la oferta";
      toast.error(errorMessage);
      throw error; // Re-throw to ensure loading state is reset
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

      <form onSubmit={handleSubmit(onSubmit, (errors) => {
        console.error("Form validation errors:", errors);
        toast.error("Por favor, completá todos los campos requeridos correctamente");
      })}>
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

                  <div className="md:col-span-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
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
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleGenerateWithAI}
                        isLoading={isGeneratingAI}
                        disabled={!selectedTenantId || !offerType || !name || isGeneratingAI}
                        leftIcon={<Sparkles className="h-4 w-4" />}
                        className="mb-0"
                      >
                        Generar con AI
                      </Button>
                    </div>
                    {selectedTenantId && offerType && name && (
                      <p className="text-xs text-slate-500 mt-1">
                        El botón de AI buscará información en el RAG del tenant para completar la oferta
                      </p>
                    )}
                  </div>

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



