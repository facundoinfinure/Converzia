"use client";

import { useRouter } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageSquare } from "lucide-react";

export default function TemplatesPage() {
  const router = useRouter();

  return (
    <PageContainer>
      <PageHeader
        title="WhatsApp Templates"
        description="Gestiona plantillas de mensajes de WhatsApp"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Configuración", href: "/admin/settings" },
          { label: "WhatsApp Templates" },
        ]}
      />

      <Card>
        <EmptyState
          icon={<MessageSquare />}
          title="Templates en desarrollo"
          description="La gestión de plantillas de WhatsApp estará disponible próximamente."
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
