"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  Globe,
  RefreshCw,
  Trash2,
  Package,
  Upload,
  Loader2,
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
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useTenantOptions } from "@/lib/hooks/use-offers";
import { formatRelativeTime } from "@/lib/utils";

// RAG Source type from database
type RagSourceType = "PDF" | "URL" | "WEBSITE_SCRAPE" | "MANUAL";

interface RagSource {
  id: string;
  tenant_id: string;
  offer_id: string | null;
  source_type: RagSourceType;
  name: string;
  description: string | null;
  source_url: string | null;
  storage_path: string | null;
  is_active: boolean;
  last_processed_at: string | null;
  created_at: string;
  updated_at: string;
  tenant?: { id: string; name: string };
  offer?: { id: string; name: string };
}

export default function KnowledgePage() {
  const toast = useToast();
  const [sources, setSources] = useState<RagSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [offerFilter, setOfferFilter] = useState("");
  const [offerOptions, setOfferOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reindexId, setReindexId] = useState<string | null>(null);

  // Form state
  const [newSource, setNewSource] = useState({
    tenant_id: "",
    offer_id: "",
    source_type: "MANUAL" as RagSourceType,
    name: "",
    description: "",
    content: "",
    url: "",
  });

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Offer options for form (based on selected tenant in form)
  const [formOfferOptions, setFormOfferOptions] = useState<Array<{ value: string; label: string }>>([]);

  const supabase = createClient();
  const { options: tenantOptions } = useTenantOptions();

  // Fetch offers when tenant filter changes
  useEffect(() => {
    async function fetchOffers() {
      if (!tenantFilter) {
        setOfferOptions([]);
        setOfferFilter("");
        return;
      }
      
      const { data } = await supabase
        .from("offers")
        .select("id, name")
        .eq("tenant_id", tenantFilter)
        .order("name");
      
      if (data) {
        setOfferOptions(data.map((o: any) => ({ value: o.id, label: o.name })));
      }
    }
    fetchOffers();
  }, [tenantFilter, supabase]);

  // Fetch offers for form when form tenant changes
  useEffect(() => {
    async function fetchFormOffers() {
      if (!newSource.tenant_id) {
        setFormOfferOptions([]);
        return;
      }
      
      const { data } = await supabase
        .from("offers")
        .select("id, name")
        .eq("tenant_id", newSource.tenant_id)
        .order("name");
      
      if (data) {
        setFormOfferOptions(data.map((o: any) => ({ value: o.id, label: o.name })));
      }
    }
    fetchFormOffers();
  }, [newSource.tenant_id, supabase]);

  useEffect(() => {
    fetchSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter, offerFilter]);

  async function fetchSources() {
    setIsLoading(true);

    let query = supabase
      .from("rag_sources")
      .select(`
        *,
        tenant:tenants(id, name),
        offer:offers(id, name)
      `)
      .order("created_at", { ascending: false });

    if (tenantFilter) {
      query = query.eq("tenant_id", tenantFilter);
    }

    if (offerFilter) {
      query = query.eq("offer_id", offerFilter);
    }

    const { data, error } = await queryWithTimeout(
      query,
      10000,
      "fetch rag sources"
    );

    if (error) {
      console.error("Error fetching rag_sources:", error);
      toast.error("Error al cargar fuentes");
    }

    setSources(
      (Array.isArray(data) ? data : []).map((s: any) => ({
        ...s,
        tenant: Array.isArray(s.tenant) ? s.tenant[0] : s.tenant,
        offer: Array.isArray(s.offer) ? s.offer[0] : s.offer,
      }))
    );
    setIsLoading(false);
  }

  const handleAdd = async () => {
    if (!newSource.tenant_id || !newSource.name) {
      toast.error("Completá los campos requeridos");
      return;
    }

    // Handle PDF upload separately
    if (newSource.source_type === "PDF") {
      if (!pdfFile) {
        toast.error("Seleccioná un archivo PDF");
        return;
      }
      await handlePdfUpload();
      return;
    }

    try {
      // First create the RAG source
      const { data: source, error: sourceError } = await supabase
        .from("rag_sources")
        .insert({
          tenant_id: newSource.tenant_id,
          offer_id: newSource.offer_id || null,
          source_type: newSource.source_type,
          name: newSource.name,
          description: newSource.description || null,
          source_url: newSource.source_type === "URL" ? newSource.url : null,
          is_active: true,
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // If it's manual content, ingest it via the API
      if (newSource.source_type === "MANUAL" && newSource.content) {
        const response = await fetch("/api/rag/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: source.id,
            content: newSource.content,
            title: newSource.name,
            doc_type: "FAQ",
          }),
        });

        const result = await response.json();
        if (!result.success) {
          console.warn("Ingestion warning:", result.error);
        }
      }

      // If it's a URL, trigger ingestion via API
      if (newSource.source_type === "URL" && newSource.url) {
        try {
          const response = await fetch("/api/rag/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_id: source.id,
              source_type: "URL",
              url: newSource.url,
              title: newSource.name,
              doc_type: "LANDING",
            }),
          });

          const result = await response.json();
          if (!result.success) {
            console.error("URL ingestion error:", result.error);
            toast.error(result.error || "Error al procesar URL");
          } else {
            toast.success(`URL procesada: ${result.chunkCount || 0} chunks creados`);
          }
        } catch (error) {
          console.error("Error calling ingest API:", error);
          toast.error("Error al procesar URL. Intenta reindexar la fuente más tarde.");
        }
      }

      toast.success("Fuente de conocimiento agregada");
      closeAndResetModal();
      fetchSources();
    } catch (error) {
      console.error("Error adding source:", error);
      toast.error("Error al agregar fuente");
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile || !newSource.tenant_id) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("tenant_id", newSource.tenant_id);
      if (newSource.offer_id) {
        formData.append("offer_id", newSource.offer_id);
      }
      formData.append("title", newSource.name || pdfFile.name.replace(".pdf", ""));

      const response = await fetch("/api/rag/ingest", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`PDF procesado: ${result.chunkCount} chunks creados`);
        closeAndResetModal();
        fetchSources();
      } else {
        toast.error(result.error || "Error al procesar PDF");
      }
    } catch (error) {
      console.error("PDF upload error:", error);
      toast.error("Error al subir PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const closeAndResetModal = () => {
    setShowAddModal(false);
    setNewSource({
      tenant_id: "",
      offer_id: "",
      source_type: "MANUAL",
      name: "",
      description: "",
      content: "",
      url: "",
    });
    setPdfFile(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      // Cascade delete will handle chunks via FK constraint
      const { error } = await supabase
        .from("rag_sources")
        .delete()
        .eq("id", deleteId);
      
      if (error) throw error;

      toast.success("Fuente eliminada");
      setDeleteId(null);
      fetchSources();
    } catch (error) {
      console.error("Error deleting source:", error);
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
      const { error } = await supabase
        .from("rag_sources")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      
      if (error) throw error;
      fetchSources();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Error al cambiar estado");
    }
  };

  // Source type icons and labels
  const typeConfig: Record<RagSourceType, { icon: React.ElementType; label: string }> = {
    PDF: { icon: FileText, label: "PDF" },
    URL: { icon: LinkIcon, label: "URL" },
    WEBSITE_SCRAPE: { icon: Globe, label: "Website" },
    MANUAL: { icon: MessageSquare, label: "Texto" },
  };

  const columns: Column<RagSource>[] = [
    {
      key: "source",
      header: "Fuente",
      cell: (s) => {
        const config = typeConfig[s.source_type] || typeConfig.MANUAL;
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <span className="font-medium text-white">{s.name}</span>
              {s.source_url && (
                <p className="text-xs text-slate-500 truncate max-w-[200px]">{s.source_url}</p>
              )}
              {s.description && !s.source_url && (
                <p className="text-xs text-slate-500 truncate max-w-[200px]">{s.description}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "context",
      header: "Contexto",
      cell: (s) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-300">{s.tenant?.name || "Sin tenant"}</span>
          </div>
          {s.offer ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Package className="h-3 w-3 text-primary-400" />
              <span className="text-xs text-primary-400">{s.offer.name}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">General del tenant</span>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      cell: (s) => {
        const config = typeConfig[s.source_type] || typeConfig.MANUAL;
        return <Badge variant="secondary">{config.label}</Badge>;
      },
    },
    {
      key: "status",
      header: "Estado",
      cell: (s) => (
        <div className="flex items-center gap-2">
          <Badge variant={s.is_active ? "success" : "secondary"} dot>
            {s.is_active ? "Activo" : "Inactivo"}
          </Badge>
          {s.last_processed_at && (
            <span className="text-xs text-slate-500">
              Procesado {formatRelativeTime(s.last_processed_at)}
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
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
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
              placeholder="Buscar por nombre..."
              className="flex-1 max-w-md"
            />
            <CustomSelect
              value={tenantFilter}
              onChange={(val) => {
                setTenantFilter(val);
                setOfferFilter(""); // Reset offer filter when tenant changes
              }}
              options={[{ value: "", label: "Todos los tenants" }, ...tenantOptions]}
              placeholder="Filtrar por tenant"
              className="w-48"
            />
            {tenantFilter && offerOptions.length > 0 && (
              <CustomSelect
                value={offerFilter}
                onChange={setOfferFilter}
                options={[{ value: "", label: "Todas las ofertas" }, ...offerOptions]}
                placeholder="Filtrar por oferta"
                className="w-48"
              />
            )}
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
        onClose={closeAndResetModal}
        title="Agregar fuente de conocimiento"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeAndResetModal} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} isLoading={isUploading}>
              {isUploading ? "Procesando..." : "Agregar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <CustomSelect
            label="Tenant"
            value={newSource.tenant_id}
            onChange={(val) => setNewSource({ ...newSource, tenant_id: val, offer_id: "" })}
            options={tenantOptions}
            placeholder="Seleccionar tenant"
            required
          />

          {newSource.tenant_id && formOfferOptions.length > 0 && (
            <CustomSelect
              label="Oferta (opcional)"
              value={newSource.offer_id}
              onChange={(val) => setNewSource({ ...newSource, offer_id: val })}
              options={[{ value: "", label: "General del tenant" }, ...formOfferOptions]}
              placeholder="Asociar a una oferta"
            />
          )}

          <Select
            label="Tipo de fuente"
            value={newSource.source_type}
            onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value as RagSourceType })}
            options={[
              { value: "MANUAL", label: "Texto libre" },
              { value: "URL", label: "URL (web)" },
              { value: "PDF", label: "PDF" },
            ]}
          />

          <Input
            label="Título"
            placeholder="Ej: Información del proyecto"
            value={newSource.name}
            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
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
          ) : newSource.source_type === "PDF" ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Archivo PDF <span className="text-red-500">*</span>
              </label>
              <div 
                className={`p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
                  pdfFile 
                    ? "border-primary-500 bg-primary-500/10" 
                    : "border-card-border hover:border-slate-500"
                }`}
              >
                {pdfFile ? (
                  <div className="space-y-2">
                    <FileText className="h-8 w-8 mx-auto text-primary-400" />
                    <p className="font-medium text-white">{pdfFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Quitar archivo
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-slate-300 mb-1">
                      Arrastrá o hacé click para seleccionar
                    </p>
                    <p className="text-xs text-slate-500">PDF hasta 10MB</p>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type !== "application/pdf") {
                            toast.error("Solo se permiten archivos PDF");
                            return;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error("El archivo no puede superar los 10MB");
                            return;
                          }
                          setPdfFile(file);
                          // Auto-fill name if empty
                          if (!newSource.name) {
                            setNewSource({
                              ...newSource,
                              name: file.name.replace(".pdf", ""),
                            });
                          }
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
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




