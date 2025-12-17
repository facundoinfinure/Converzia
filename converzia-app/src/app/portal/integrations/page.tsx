"use client";

import { useState, useEffect } from "react";
import {
  Link2,
  Sheet,
  Database,
  Webhook,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

interface Integration {
  id: string;
  integration_type: "GOOGLE_SHEETS" | "TOKKO" | "WEBHOOK";
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING_SETUP";
  is_active: boolean;
  is_primary: boolean;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
  sync_count: number;
  error_count: number;
  created_at: string;
}

const integrationTypes = [
  {
    type: "TOKKO" as const,
    name: "Tokko CRM",
    description: "Sincroniza leads directamente con tu Tokko Broker CRM",
    icon: Database,
    color: "from-blue-500 to-cyan-500",
  },
  {
    type: "GOOGLE_SHEETS" as const,
    name: "Google Sheets",
    description: "Registra todos los leads en una planilla de Google",
    icon: Sheet,
    color: "from-emerald-500 to-teal-500",
  },
  {
    type: "WEBHOOK" as const,
    name: "Webhook personalizado",
    description: "Envía leads a cualquier endpoint HTTP",
    icon: Webhook,
    color: "from-purple-500 to-pink-500",
  },
];

export default function PortalIntegrationsPage() {
  const { activeTenant, hasPermission } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<"TOKKO" | "GOOGLE_SHEETS" | "WEBHOOK" | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    // Tokko
    tokko_api_key: "",
    tokko_api_url: "https://www.tokkobroker.com/api/v1",
    // Google Sheets
    sheets_spreadsheet_id: "",
    sheets_sheet_name: "Leads",
    sheets_service_account: "",
    // Webhook
    webhook_url: "",
    webhook_method: "POST",
    webhook_auth_type: "none",
    webhook_auth_value: "",
  });

  useEffect(() => {
    if (activeTenant) {
      loadIntegrations();
    }
  }, [activeTenant]);

  async function loadIntegrations() {
    if (!activeTenant) return;
    
    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", activeTenant.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setIntegrations(data as Integration[]);
    }

    setIsLoading(false);
  }

  function openAddModal(type: "TOKKO" | "GOOGLE_SHEETS" | "WEBHOOK") {
    setSelectedType(type);
    setEditingIntegration(null);
    setFormData({
      name: integrationTypes.find((t) => t.type === type)?.name || "",
      tokko_api_key: "",
      tokko_api_url: "https://www.tokkobroker.com/api/v1",
      sheets_spreadsheet_id: "",
      sheets_sheet_name: "Leads",
      sheets_service_account: "",
      webhook_url: "",
      webhook_method: "POST",
      webhook_auth_type: "none",
      webhook_auth_value: "",
    });
    setTestResult(null);
    setShowModal(true);
  }

  function openEditModal(integration: Integration) {
    setSelectedType(integration.integration_type);
    setEditingIntegration(integration);
    
    const config = integration.config as any;
    setFormData({
      name: integration.name,
      tokko_api_key: config.api_key || "",
      tokko_api_url: config.api_url || "https://www.tokkobroker.com/api/v1",
      sheets_spreadsheet_id: config.spreadsheet_id || "",
      sheets_sheet_name: config.sheet_name || "Leads",
      sheets_service_account: config.service_account_json || "",
      webhook_url: config.url || "",
      webhook_method: config.method || "POST",
      webhook_auth_type: config.auth_type || "none",
      webhook_auth_value: config.auth_value || "",
    });
    setTestResult(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!activeTenant || !selectedType) return;

    setIsSaving(true);
    const supabase = createClient();

    let config: Record<string, unknown> = {};

    if (selectedType === "TOKKO") {
      config = {
        api_key: formData.tokko_api_key,
        api_url: formData.tokko_api_url,
      };
    } else if (selectedType === "GOOGLE_SHEETS") {
      config = {
        spreadsheet_id: formData.sheets_spreadsheet_id,
        sheet_name: formData.sheets_sheet_name,
        service_account_json: formData.sheets_service_account,
      };
    } else if (selectedType === "WEBHOOK") {
      config = {
        url: formData.webhook_url,
        method: formData.webhook_method,
        auth_type: formData.webhook_auth_type,
        auth_value: formData.webhook_auth_value,
      };
    }

    const integrationData = {
      tenant_id: activeTenant.id,
      integration_type: selectedType,
      name: formData.name,
      config,
      is_active: true,
      status: "ACTIVE" as const,
    };

    let error;

    if (editingIntegration) {
      const result = await supabase
        .from("tenant_integrations")
        .update(integrationData)
        .eq("id", editingIntegration.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("tenant_integrations")
        .insert(integrationData);
      error = result.error;
    }

    setIsSaving(false);

    if (!error) {
      setShowModal(false);
      loadIntegrations();
    } else {
      console.error("Error saving integration:", error);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: activeTenant?.id,
          type: selectedType,
          config: selectedType === "TOKKO" 
            ? { api_key: formData.tokko_api_key, api_url: formData.tokko_api_url }
            : selectedType === "GOOGLE_SHEETS"
            ? { 
                spreadsheet_id: formData.sheets_spreadsheet_id,
                sheet_name: formData.sheets_sheet_name,
                service_account_json: formData.sheets_service_account,
              }
            : { url: formData.webhook_url },
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: "Error al probar conexión" });
    }

    setIsTesting(false);
  }

  async function handleToggle(integration: Integration) {
    const supabase = createClient();

    await supabase
      .from("tenant_integrations")
      .update({ is_active: !integration.is_active })
      .eq("id", integration.id);

    loadIntegrations();
  }

  async function handleDelete(integration: Integration) {
    if (!confirm("¿Estás seguro de eliminar esta integración?")) return;

    const supabase = createClient();
    await supabase
      .from("tenant_integrations")
      .delete()
      .eq("id", integration.id);

    loadIntegrations();
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Integraciones" description="Conecta tus herramientas" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </PageContainer>
    );
  }

  const canManage = hasPermission("settings:manage");

  return (
    <PageContainer>
      <PageHeader
        title="Integraciones"
        description="Conecta Converzia con tus herramientas de trabajo"
      />

      {/* Active Integrations */}
      {integrations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Integraciones activas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => {
              const typeInfo = integrationTypes.find((t) => t.type === integration.integration_type);
              const Icon = typeInfo?.icon || Link2;

              return (
                <Card key={integration.id} className="relative">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${typeInfo?.color || "from-slate-500 to-slate-600"} flex items-center justify-center`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.is_active ? (
                          <Badge variant="success">Activa</Badge>
                        ) : (
                          <Badge variant="default">Pausada</Badge>
                        )}
                        {integration.last_sync_status === "FAILED" && (
                          <Badge variant="danger">Error</Badge>
                        )}
                      </div>
                    </div>

                    <h3 className="font-semibold text-white mb-1">{integration.name}</h3>
                    <p className="text-sm text-slate-400 mb-4">
                      {integration.sync_count} sincronizaciones
                      {integration.last_sync_at && (
                        <> · Última: {formatRelativeTime(integration.last_sync_at)}</>
                      )}
                    </p>

                    {integration.last_error && (
                      <Alert variant="error" className="mb-4" title="Error">
                        {integration.last_error}
                      </Alert>
                    )}

                    {canManage && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEditModal(integration)}
                          leftIcon={<Settings className="h-4 w-4" />}
                        >
                          Configurar
                        </Button>
                        <Button
                          size="sm"
                          variant={integration.is_active ? "ghost" : "success"}
                          onClick={() => handleToggle(integration)}
                        >
                          {integration.is_active ? "Pausar" : "Activar"}
                        </Button>
                        <IconButton
                          size="sm"
                          variant="danger"
                          icon={<Trash2 className="h-4 w-4" />}
                          aria-label="Eliminar"
                          onClick={() => handleDelete(integration)}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          {integrations.length > 0 ? "Agregar más integraciones" : "Integraciones disponibles"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrationTypes.map((type) => {
            const Icon = type.icon;
            const hasActive = integrations.some(
              (i) => i.integration_type === type.type && i.is_active
            );

            return (
              <Card key={type.type} hover={canManage}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    {hasActive && <Badge variant="success">Configurada</Badge>}
                  </div>

                  <h3 className="font-semibold text-white mb-1">{type.name}</h3>
                  <p className="text-sm text-slate-400 mb-4">{type.description}</p>

                  {canManage && (
                    <Button
                      size="sm"
                      variant={hasActive ? "secondary" : "primary"}
                      onClick={() => openAddModal(type.type)}
                      leftIcon={<Plus className="h-4 w-4" />}
                      fullWidth
                    >
                      {hasActive ? "Agregar otra" : "Configurar"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Configuration Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingIntegration ? "Editar integración" : "Nueva integración"}
        size="lg"
      >
        <div className="space-y-6">
          {/* Integration name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nombre de la integración
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Tokko Principal, Sheets Backup..."
            />
          </div>

          {/* Tokko Config */}
          {selectedType === "TOKKO" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  API Key de Tokko
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={formData.tokko_api_key}
                    onChange={(e) => setFormData({ ...formData, tokko_api_key: e.target.value })}
                    placeholder="Tu API key de Tokko Broker"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Encontrá tu API Key en Tokko: Mi Empresa → Permisos
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  URL de API (opcional)
                </label>
                <Input
                  value={formData.tokko_api_url}
                  onChange={(e) => setFormData({ ...formData, tokko_api_url: e.target.value })}
                  placeholder="https://www.tokkobroker.com/api/v1"
                />
              </div>
            </>
          )}

          {/* Google Sheets Config */}
          {selectedType === "GOOGLE_SHEETS" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  ID del Spreadsheet
                </label>
                <Input
                  value={formData.sheets_spreadsheet_id}
                  onChange={(e) => setFormData({ ...formData, sheets_spreadsheet_id: e.target.value })}
                  placeholder="El ID está en la URL del spreadsheet"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Ej: de docs.google.com/spreadsheets/d/<strong>1BxiM.../</strong>edit
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre de la hoja
                </label>
                <Input
                  value={formData.sheets_sheet_name}
                  onChange={(e) => setFormData({ ...formData, sheets_sheet_name: e.target.value })}
                  placeholder="Leads"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Credenciales de Service Account (JSON)
                </label>
                <TextArea
                  value={formData.sheets_service_account}
                  onChange={(e) => setFormData({ ...formData, sheets_service_account: e.target.value })}
                  placeholder='{"type": "service_account", ...}'
                  rows={6}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Creá un Service Account en Google Cloud Console y compartí el spreadsheet con su email.
                </p>
              </div>
            </>
          )}

          {/* Webhook Config */}
          {selectedType === "WEBHOOK" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  URL del Webhook
                </label>
                <Input
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  placeholder="https://tu-servidor.com/webhook"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Autenticación
                </label>
                <select
                  value={formData.webhook_auth_type}
                  onChange={(e) => setFormData({ ...formData, webhook_auth_type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-card border border-card-border text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="none">Sin autenticación</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key">API Key (header)</option>
                </select>
              </div>
              {formData.webhook_auth_type !== "none" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {formData.webhook_auth_type === "bearer" ? "Token" : "API Key"}
                  </label>
                  <Input
                    type="password"
                    value={formData.webhook_auth_value}
                    onChange={(e) => setFormData({ ...formData, webhook_auth_value: e.target.value })}
                    placeholder="Tu token o API key"
                  />
                </div>
              )}
            </>
          )}

          {/* Test Result */}
          {testResult && (
            <Alert
              variant={testResult.success ? "success" : "error"}
              title={testResult.success ? "Conexión exitosa" : "Error de conexión"}
            >
              {testResult.message}
            </Alert>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-card-border">
            <Button
              variant="secondary"
              onClick={handleTest}
              isLoading={isTesting}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Probar conexión
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                disabled={!formData.name}
              >
                {editingIntegration ? "Guardar cambios" : "Crear integración"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

