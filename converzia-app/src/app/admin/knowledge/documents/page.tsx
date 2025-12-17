"use client";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

export default function KnowledgeDocumentsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Documentos"
        description="Gestiona documentos procesados para RAG"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Knowledge (RAG)", href: "/admin/knowledge" },
          { label: "Documentos" },
        ]}
      />

      <Card>
        <EmptyState
          icon={<FileText />}
          title="Documentos en desarrollo"
          description="La gestión de documentos procesados estará disponible próximamente."
          size="lg"
        />
      </Card>
    </PageContainer>
  );
}
