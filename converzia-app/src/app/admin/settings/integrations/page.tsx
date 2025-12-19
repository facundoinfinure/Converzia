"use client";

import { useRouter } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Webhook } from "lucide-react";

export default function IntegrationsPage() {
  const router = useRouter();

  return (
    <PageContainer>
      <PageHeader
        title="Integraciones"
        description="Gestiona las integraciones de la plataforma"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Configuración", href: "/admin/settings" },
          { label: "Integraciones" },
        ]}
      />

      <Card>
        <EmptyState
          icon={<Webhook />}
          title="Integraciones"
          description="Las configuraciones de integraciones están disponibles en la página principal de Configuración."
          size="lg"
          action={{
            label: "Ir a Configuración",
            onClick: () => router.push("/admin/settings"),
          }}
        />
      </Card>
    </PageContainer>
  );
}


