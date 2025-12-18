"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter, CardSection } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useTenantMutations } from "@/lib/hooks/use-tenants";
import { createTenantSchema, type CreateTenantInput } from "@/lib/validations/tenant";
import { slugify } from "@/lib/utils";

// Timezone options for Argentina
const timezoneOptions = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Argentina/Cordoba", label: "Córdoba (GMT-3)" },
  { value: "America/Argentina/Mendoza", label: "Mendoza (GMT-3)" },
];

export default function NewTenantPage() {
  const router = useRouter();
  const toast = useToast();
  const { createTenant, isLoading } = useTenantMutations();
  const [autoSlug, setAutoSlug] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      timezone: "America/Argentina/Buenos_Aires",
      default_score_threshold: 80,
      duplicate_window_days: 90,
    },
  });

  const name = watch("name");

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (autoSlug) {
      setValue("slug", slugify(newName));
    }
  };

  const onSubmit = async (data: CreateTenantInput) => {
    try {
      const tenant = await createTenant({
        ...data,
        timezone: data.timezone || "America/Argentina/Buenos_Aires",
        default_score_threshold: data.default_score_threshold || 80,
        duplicate_window_days: data.duplicate_window_days || 90,
        contact_email: data.contact_email || undefined,
        contact_phone: data.contact_phone || undefined,
      });
      toast.success("Tenant creado correctamente");
      router.push(`/admin/tenants/${(tenant as any).id}`);
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      const errorMessage = error?.message || "Error al crear el tenant";
      toast.error(errorMessage);
    }
  };

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="Nuevo Tenant"
        description="Crear un nuevo tenant en la plataforma"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Tenants", href: "/admin/tenants" },
          { label: "Nuevo" },
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
                onClick={() => router.push("/admin/tenants")}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Crear Tenant
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </PageContainer>
  );
}


