"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  Upload,
  RefreshCw,
  Trash2,
  Search,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select, CustomSelect } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { useTenantOptions } from "@/lib/hooks/use-offers";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { KnowledgeSource } from "@/types";

export default function KnowledgePage() {
  const toast = useToast();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reindexId, setReindexId] = useState<string | null>(null);

  // Form state
  const [newSource, setNewSource] = useState({
    tenant_id: "",
    offer_id: "",
    source_type: "TEXT" as "PDF" | "URL" | "TEXT" | "FAQ",
    title: "",
    content: "",
    url: "",
  });

  const supabase = createClient();
  const { options: tenantOptions } = useTenantOptions();

  useEffect(() => {
    fetchSources();
  }, [tenantFilter]);

  async function fetchSources() {
    setIsLoading(true);

    let query = (supabase as any)
      .from("knowledge_sources")
      .select(`
        *,
        tenant:tenants(id, name),
        offer:offers(id, name)
      `)
      .order("created_at", { ascending: false });

    if (tenantFilter) {
      query = query.eq("tenant_id", tenantFilter);
    }

    const { data } = await query;

    setSources(
      (data || []).map((s: any) => ({
        ...s,
        tenant: Array.isArray(s.tenant) ? s.tenant[0] : s.tenant,
        offer: Array.isArray(s.offer) ? s.offer[0] : s.offer,
      }))
    );
    setIsLoading(false);
  }

  const handleAdd = async () => {
    if (!newSource.tenant_id || !newSource.title) {
      toast.error("Completá los campos requeridos");
      return;
    }

    try {
      const { error } = await (supabase as any).from("knowledge_sources").insert({
        tenant_id: newSource.tenant_id,
        offer_id: newSource.offer_id || null,
        source_type: newSource.source_type,
        title: newSource.title,
        content: newSource.content || null,
        url: newSource.url || null,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Fuente de conocimiento agregada");
      setShowAddModal(false);
      setNewSource({
        tenant_id: "",
        offer_id: "",
        source_type: "TEXT",
        title: "",
        content: "",
        url: "",
      });
      fetchSources();
    } catch (error) {
      toast.error("Error al agregar fuente");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      // Delete chunks first
      await (supabase as any).from("knowledge_chunks").delete().eq("source_id", deleteId);
      // Delete source
      const { error } = await (supabase as any).from("knowledge_sources").delete().eq("id", deleteId);
      if (error) throw error;

      toast.success("Fuente eliminada");
      setDeleteId(null);
      fetchSources();
    } catch (error) {
      toast.error("Error al eliminar fuente");
    }
  };

  const handleReindex = async () => {
    if (!reindexId) return;

    try {
      // Call the RAG reindex API
      const response = await fetch("/api/rag/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: reindexId }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Reindexación completada: ${result.chunkCount} chunks`);
      } else {
        toast.error(result.error || "Error al reindexar");
      }

      setReindexId(null);
      fetchSources();
    } catch (error) {
      toast.error("Error al reindexar");
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await (supabase as any)
        .from("knowledge_sources")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      fetchSources();
    } catch (error) {
      toast.error("Error al cambiar estado");
    }
  };

  // Source type icons
  const typeIcons: Record<string, React.ElementType> = {
    PDF: FileText,
    URL: LinkIcon,
    TEXT: MessageSquare,
    FAQ: BookOpen,
  };

  const columns: Column<KnowledgeSource & { tenant?: any; offer?: any }>[] = [
    {
      key: "source",
      header: "Fuente",
      cell: (s) => {
        const Icon = typeIcons[s.source_type] || FileText;
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <span className="font-medium text-white">{s.title}</span>
              {s.url && (
                <p className="text-xs text-slate-500 truncate max-w-[200px]">{s.url}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "tenant",
      header: "Tenant / Oferta",
      cell: (s) => (
        <div>
          <span className="text-slate-300">{s.tenant?.name || "Global"}</span>
          {s.offer && (
            <p className="text-xs text-slate-500">{s.offer.name}</p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      cell: (s) => (
        <Badge variant="secondary">{s.source_type}</Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (s) => (
        <div className="flex items-center gap-2">
          <Badge variant={s.is_active ? "success" : "secondary"} dot>
            {s.is_active ? "Activo" : "Inactivo"}
          </Badge>
          {s.last_indexed_at && (
            <span className="text-xs text-slate-500">
              Indexado {formatRelativeTime(s.last_indexed_at)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "120px",
      cell: (s) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReindexId(s.id)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-card-border transition-colors"
            title="Reindexar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleActive(s.id, s.is_active)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-card-border transition-colors"
            title={s.is_active ? "Desactivar" : "Activar"}
          >
            {s.is_active ? "🔇" : "🔊"}
          </button>
          <button
            onClick={() => setDeleteId(s.id)}
            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredSources = sources.filter(
    (s) =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <PageHeader
        title="Knowledge Base"
        description="Gestiona las fuentes de conocimiento para el RAG"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Knowledge" },
        ]}
        actions={
          <Button
            onClick={() => setShowAddModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Agregar fuente
          </Button>
        }
      />

      <Card>
        {/* Filters */}
        <div className="p-4 border-b border-card-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por título o contenido..."
              className="flex-1 max-w-md"
            />
            <CustomSelect
              value={tenantFilter}
              onChange={setTenantFilter}
              options={[{ value: "", label: "Todos los tenants" }, ...tenantOptions]}
              placeholder="Filtrar por tenant"
              className="w-48"
            />
          </div>
        </div>

        <DataTable
          data={filteredSources}
          columns={columns}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={<BookOpen />}
              title="Sin fuentes de conocimiento"
              description="Agregá documentos, URLs o FAQs para mejorar las respuestas del bot."
              action={{
                label: "Agregar primera fuente",
                onClick: () => setShowAddModal(true),
              }}
            />
          }
        />
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Agregar fuente de conocimiento"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd}>Agregar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <CustomSelect
            label="Tenant"
            value={newSource.tenant_id}
            onChange={(val) => setNewSource({ ...newSource, tenant_id: val })}
            options={tenantOptions}
            placeholder="Seleccionar tenant"
            required
          />

          <Select
            label="Tipo de fuente"
            value={newSource.source_type}
            onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value as any })}
            options={[
              { value: "TEXT", label: "Texto libre" },
              { value: "FAQ", label: "FAQ" },
              { value: "URL", label: "URL (web)" },
              { value: "PDF", label: "PDF (pronto)" },
            ]}
          />

          <Input
            label="Título"
            placeholder="Ej: Información del proyecto"
            value={newSource.title}
            onChange={(e) => setNewSource({ ...newSource, title: e.target.value })}
            required
          />

          {newSource.source_type === "URL" ? (
            <Input
              label="URL"
              type="url"
              placeholder="https://..."
              value={newSource.url}
              onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
              required
            />
          ) : (
            <TextArea
              label="Contenido"
              placeholder="Texto que el bot usará para responder..."
              rows={6}
              value={newSource.content}
              onChange={(e) => setNewSource({ ...newSource, content: e.target.value })}
              required
            />
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar fuente"
        description="¿Estás seguro? Se eliminarán también todos los chunks indexados."
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Reindex Confirmation */}
      <ConfirmModal
        isOpen={!!reindexId}
        onClose={() => setReindexId(null)}
        onConfirm={handleReindex}
        title="Reindexar fuente"
        description="Se volverá a procesar y generar embeddings para esta fuente."
        confirmText="Reindexar"
      />
    </PageContainer>
  );
}

