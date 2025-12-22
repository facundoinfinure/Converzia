"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Globe,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useTenantOptions } from "@/lib/hooks/use-offers";
import { formatRelativeTime } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/Select";

interface RagDocument {
  id: string;
  source_id: string;
  tenant_id: string;
  offer_id: string | null;
  title: string | null;
  url: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  error_message: string | null;
  doc_type: string | null;
  language: string;
  page_count: number | null;
  word_count: number | null;
  chunk_count: number;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  tenant?: { id: string; name: string };
  offer?: { id: string; name: string };
  source?: { id: string; name: string };
}

export default function KnowledgeDocumentsPage() {
  const toast = useToast();
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const supabase = createClient();
  const { options: tenantOptions } = useTenantOptions();

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);

    try {
      if (!supabase) {
        toast.error("Error de conexión con Supabase");
        return;
      }

      let query = supabase
        .from("rag_documents")
        .select(`
          *,
          tenant:tenants(id, name),
          offer:offers(id, name),
          source:rag_sources(id, name)
        `)
        .order("created_at", { ascending: false });

      if (tenantFilter) {
        query = query.eq("tenant_id", tenantFilter);
      }

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await queryWithTimeout(
        query,
        10000,
        "fetch rag documents"
      );

      if (error) {
        console.error("Error fetching rag_documents:", error);
        toast.error("Error al cargar documentos");
      }

      setDocuments(
        (Array.isArray(data) ? data : []).map((d: any) => ({
          ...d,
          tenant: Array.isArray(d.tenant) ? d.tenant[0] : d.tenant,
          offer: Array.isArray(d.offer) ? d.offer[0] : d.offer,
          source: Array.isArray(d.source) ? d.source[0] : d.source,
        }))
      );
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Error al cargar documentos");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, tenantFilter, statusFilter, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary"; icon: React.ElementType }> = {
    COMPLETED: { label: "Completado", variant: "success", icon: CheckCircle },
    PROCESSING: { label: "Procesando", variant: "warning", icon: Clock },
    FAILED: { label: "Fallido", variant: "danger", icon: XCircle },
    PENDING: { label: "Pendiente", variant: "secondary", icon: Clock },
  };

  const columns: Column<RagDocument>[] = [
    {
      key: "document",
      header: "Documento",
      cell: (d) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-400" />
          </div>
          <div>
            <span className="font-medium text-white">{d.title || "Sin título"}</span>
            {d.url && (
              <p className="text-xs text-slate-500 truncate max-w-[200px]">{d.url}</p>
            )}
            {d.doc_type && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {d.doc_type}
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "context",
      header: "Contexto",
      cell: (d) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-300">{d.tenant?.name || "Sin tenant"}</span>
          </div>
          {d.offer ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Package className="h-3 w-3 text-primary-400" />
              <span className="text-xs text-primary-400">{d.offer.name}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">General del tenant</span>
          )}
          {d.source && (
            <div className="flex items-center gap-1 mt-0.5">
              <Globe className="h-3 w-3 text-slate-500" />
              <span className="text-xs text-slate-500">{d.source.name}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (d) => {
        const config = statusConfig[d.status] || statusConfig.PENDING;
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} dot>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {d.error_message && (
              <span className="text-xs text-red-400 truncate max-w-[150px]" title={d.error_message}>
                {d.error_message}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "stats",
      header: "Estadísticas",
      cell: (d) => (
        <div className="text-sm text-slate-400">
          {d.chunk_count > 0 && (
            <div>{d.chunk_count} chunks</div>
          )}
          {d.word_count && (
            <div className="text-xs">{d.word_count.toLocaleString()} palabras</div>
          )}
          {d.page_count && (
            <div className="text-xs">{d.page_count} páginas</div>
          )}
        </div>
      ),
    },
    {
      key: "processed",
      header: "Procesado",
      cell: (d) => (
        <div className="text-sm text-slate-400">
          {d.processed_at ? (
            <div>
              <div>{formatRelativeTime(d.processed_at)}</div>
              <div className="text-xs text-slate-500">
                {new Date(d.processed_at).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <span className="text-slate-500">No procesado</span>
          )}
        </div>
      ),
    },
  ];

  const filteredDocuments = documents.filter(
    (d) =>
      !search ||
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.url?.toLowerCase().includes(search.toLowerCase()) ||
      d.tenant?.name.toLowerCase().includes(search.toLowerCase()) ||
      d.offer?.name.toLowerCase().includes(search.toLowerCase())
  );

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
        {/* Filters */}
        <div className="p-4 border-b border-card-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por título, URL, tenant..."
              className="flex-1 max-w-md"
            />
            <CustomSelect
              value={tenantFilter}
              onChange={(val) => setTenantFilter(val)}
              options={[{ value: "", label: "Todos los tenants" }, ...tenantOptions]}
              placeholder="Filtrar por tenant"
              className="w-48"
            />
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: "", label: "Todos los estados" },
                { value: "COMPLETED", label: "Completado" },
                { value: "PROCESSING", label: "Procesando" },
                { value: "PENDING", label: "Pendiente" },
                { value: "FAILED", label: "Fallido" },
              ]}
              placeholder="Filtrar por estado"
              className="w-48"
            />
          </div>
        </div>

        <DataTable
          data={filteredDocuments}
          columns={columns}
          keyExtractor={(d) => d.id}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={<FileText />}
              title="Sin documentos procesados"
              description="Los documentos aparecerán aquí una vez que se procesen desde las fuentes de conocimiento."
            />
          }
        />
      </Card>
    </PageContainer>
  );
}







