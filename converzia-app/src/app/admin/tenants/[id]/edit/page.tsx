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
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { useTenant, useTenantMutations } from "@/lib/hooks/use-tenants";
import { updateTenantSchema, type UpdateTenantInput } from "@/lib/validations/tenant";
import { slugify } from "@/lib/utils";

// Timezone options for Argentina
const timezoneOptions = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Argentina/Cordoba", label: "Córdoba (GMT-3)" },
  { value: "America/Argentina/Mendoza", label: "Mendoza (GMT-3)" },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditTenantPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { tenant, isLoading: loadingTenant, refetch } = useTenant(id);
  const { updateTenant, isLoading } = useTenantMutations();
  const [autoSlug, setAutoSlug] = useState(true);

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
    </PageContainer>
  );
}







