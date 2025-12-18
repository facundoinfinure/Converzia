"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
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
import { useWhatsAppTemplates } from "@/lib/hooks/use-settings";
import { formatRelativeTime } from "@/lib/utils";

interface WhatsAppTemplate {
  id: string;
  template_name: string;
  template_id: string | null;
  language: string;
  category: string;
  status: string;
  body_text: string;
  header_type: string | null;
  header_content: string | null;
  footer_text: string | null;
  buttons: any[];
  variables: any[];
  use_for: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TemplatesPage() {
  const toast = useToast();
  const {
    templates,
    isLoading,
    error,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useWhatsAppTemplates();

  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    template_name: "",
    language: "es",
    category: "UTILITY",
    body_text: "",
    header_type: "",
    header_content: "",
    footer_text: "",
    use_for: [] as string[],
    is_active: true,
  });

  const handleOpenAdd = () => {
    setFormData({
      template_name: "",
      language: "es",
      category: "UTILITY",
      body_text: "",
      header_type: "",
      header_content: "",
      footer_text: "",
      use_for: [],
      is_active: true,
    });
    setEditingTemplate(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (template: WhatsAppTemplate) => {
    setFormData({
      template_name: template.template_name,
      language: template.language,
      category: template.category,
      body_text: template.body_text,
      header_type: template.header_type || "",
      header_content: template.header_content || "",
      footer_text: template.footer_text || "",
      use_for: template.use_for || [],
      is_active: template.is_active,
    });
    setEditingTemplate(template);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!formData.template_name || !formData.body_text) {
      toast.error("Completá los campos requeridos");
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, formData);
        toast.success("Template actualizado");
      } else {
        await createTemplate(formData);
        toast.success("Template creado");
      }
      setShowAddModal(false);
      refetch();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Error al guardar template");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteTemplate(deleteId);
      toast.success("Template eliminado");
      setDeleteId(null);
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error(error.message || "Error al eliminar template");
    }
  };

  const toggleActive = async (template: WhatsAppTemplate) => {
    try {
      await updateTemplate(template.id, { is_active: !template.is_active });
      toast.success(`Template ${!template.is_active ? "activado" : "desactivado"}`);
      refetch();
    } catch (error: any) {
      console.error("Error toggling template:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary"; icon: React.ElementType }> = {
    APPROVED: { label: "Aprobado", variant: "success", icon: CheckCircle },
    PENDING: { label: "Pendiente", variant: "warning", icon: Clock },
    REJECTED: { label: "Rechazado", variant: "danger", icon: XCircle },
  };

  const categoryLabels: Record<string, string> = {
    MARKETING: "Marketing",
    UTILITY: "Utilidad",
    AUTHENTICATION: "Autenticación",
  };

  const useForLabels: Record<string, string> = {
    INITIAL_CONTACT: "Contacto inicial",
    FOLLOW_UP: "Seguimiento",
    REACTIVATION: "Reactivación",
  };

  const columns: Column<WhatsAppTemplate>[] = [
    {
      key: "template",
      header: "Template",
      cell: (t) => (
        <div>
          <div className="font-medium text-white">{t.template_name}</div>
          <div className="text-xs text-slate-500 mt-1">
            {t.body_text.substring(0, 60)}
            {t.body_text.length > 60 ? "..." : ""}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      cell: (t) => (
        <div>
          <Badge variant="secondary">{categoryLabels[t.category] || t.category}</Badge>
          <div className="text-xs text-slate-500 mt-1">{t.language.toUpperCase()}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (t) => {
        const config = statusConfig[t.status] || statusConfig.PENDING;
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} dot>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {t.is_active ? (
              <Badge variant="success" className="text-xs">Activo</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Inactivo</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "use_for",
      header: "Uso",
      cell: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.use_for && t.use_for.length > 0 ? (
            t.use_for.map((uf) => (
              <Badge key={uf} variant="secondary" className="text-xs">
                {useForLabels[uf] || uf}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-slate-500">Sin uso definido</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "180px",
      cell: (t) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(t.id)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-card-border transition-colors"
            title="Vista previa"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleActive(t)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-card-border transition-colors"
            title={t.is_active ? "Desactivar" : "Activar"}
          >
            {t.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={() => handleOpenEdit(t)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-card-border transition-colors"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteId(t.id)}
            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredTemplates = templates.filter(
    (t) =>
      !search ||
      t.template_name.toLowerCase().includes(search.toLowerCase()) ||
      t.body_text.toLowerCase().includes(search.toLowerCase())
  );

  const previewTemplate = templates.find((t) => t.id === showPreview);

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
        actions={
          <Button onClick={handleOpenAdd} leftIcon={<Plus className="h-4 w-4" />}>
            Nueva plantilla
          </Button>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <Card>
        {/* Filters */}
        <div className="p-4 border-b border-card-border">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre o contenido..."
            className="max-w-md"
          />
        </div>

        <DataTable
          data={filteredTemplates}
          columns={columns}
          keyExtractor={(t) => t.id}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={<MessageSquare />}
              title="Sin templates de WhatsApp"
              description="Creá plantillas de mensajes para usar en conversaciones automatizadas."
              action={{
                label: "Crear primera plantilla",
                onClick: handleOpenAdd,
              }}
            />
          }
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingTemplate ? "Editar template" : "Nueva plantilla"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "Actualizar" : "Crear"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre del template"
            placeholder="Ej: converzia_initial_contact"
            value={formData.template_name}
            onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Idioma"
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              options={[
                { value: "es", label: "Español" },
                { value: "en", label: "Inglés" },
                { value: "pt", label: "Portugués" },
              ]}
            />

            <Select
              label="Categoría"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { value: "MARKETING", label: "Marketing" },
                { value: "UTILITY", label: "Utilidad" },
                { value: "AUTHENTICATION", label: "Autenticación" },
              ]}
            />
          </div>

          <TextArea
            label="Cuerpo del mensaje"
            placeholder="Hola {{1}}, soy el asistente de {{2}}..."
            rows={6}
            value={formData.body_text}
            onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
            required
          />

          <Input
            label="Footer (opcional)"
            placeholder="Texto del pie de página"
            value={formData.footer_text}
            onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Uso del template
            </label>
            <div className="space-y-2">
              {Object.entries(useForLabels).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.use_for.includes(value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          use_for: [...formData.use_for, value],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          use_for: formData.use_for.filter((uf) => uf !== value),
                        });
                      }
                    }}
                    className="rounded border-card-border"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-card-border"
            />
            <span className="text-sm text-foreground">Template activo</span>
          </label>
        </div>
      </Modal>

      {/* Preview Modal */}
      {previewTemplate && (
        <Modal
          isOpen={!!showPreview}
          onClose={() => setShowPreview(null)}
          title="Vista previa del template"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-foreground mb-2">Nombre</div>
              <div className="text-white">{previewTemplate.template_name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground mb-2">Categoría</div>
              <Badge variant="secondary">
                {categoryLabels[previewTemplate.category] || previewTemplate.category}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground mb-2">Mensaje</div>
              <div className="p-4 bg-slate-800 rounded-lg text-white whitespace-pre-wrap">
                {previewTemplate.body_text}
              </div>
            </div>
            {previewTemplate.footer_text && (
              <div>
                <div className="text-sm font-medium text-foreground mb-2">Footer</div>
                <div className="text-slate-400">{previewTemplate.footer_text}</div>
              </div>
            )}
            {previewTemplate.use_for && previewTemplate.use_for.length > 0 && (
              <div>
                <div className="text-sm font-medium text-foreground mb-2">Uso</div>
                <div className="flex flex-wrap gap-1">
                  {previewTemplate.use_for.map((uf) => (
                    <Badge key={uf} variant="secondary">
                      {useForLabels[uf] || uf}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar template"
        description="¿Estás seguro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </PageContainer>
  );
}

