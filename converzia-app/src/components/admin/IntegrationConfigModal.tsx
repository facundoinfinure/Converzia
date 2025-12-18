"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { copyToClipboard } from "@/lib/utils";

// ============================================
// Integration Config Modal
// ============================================

type IntegrationType = "GOOGLE_SHEETS" | "TOKKO";

interface IntegrationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: IntegrationType;
  tenantId: string;
  existingConfig?: GoogleSheetsFormConfig | TokkoFormConfig | null;
  existingIntegrationId?: string | null;
}

interface GoogleSheetsFormConfig {
  spreadsheet_id: string;
  sheet_name: string;
  service_account_json: string;
}

interface TokkoFormConfig {
  api_key: string;
  api_url: string;
}

const DEFAULT_GOOGLE_CONFIG: GoogleSheetsFormConfig = {
  spreadsheet_id: "",
  sheet_name: "Leads",
  service_account_json: "",
};

const DEFAULT_TOKKO_CONFIG: TokkoFormConfig = {
  api_key: "",
  api_url: "https://www.tokkobroker.com/api/v1",
};

export function IntegrationConfigModal({
  isOpen,
  onClose,
  onSuccess,
  type,
  tenantId,
  existingConfig,
  existingIntegrationId,
}: IntegrationConfigModalProps) {
  const toast = useToast();
  const supabase = createClient();

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Form states
  const [googleConfig, setGoogleConfig] = useState<GoogleSheetsFormConfig>(
    DEFAULT_GOOGLE_CONFIG
  );
  const [tokkoConfig, setTokkoConfig] = useState<TokkoFormConfig>(
    DEFAULT_TOKKO_CONFIG
  );

  // Load existing config when modal opens
  useEffect(() => {
    if (isOpen && existingConfig) {
      if (type === "GOOGLE_SHEETS") {
        setGoogleConfig(existingConfig as GoogleSheetsFormConfig);
      } else if (type === "TOKKO") {
        setTokkoConfig(existingConfig as TokkoFormConfig);
      }
    } else if (isOpen) {
      // Reset to defaults
      setGoogleConfig(DEFAULT_GOOGLE_CONFIG);
      setTokkoConfig(DEFAULT_TOKKO_CONFIG);
    }
    setTestResult(null);
    setShowSecrets({});
  }, [isOpen, existingConfig, type]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const config = type === "GOOGLE_SHEETS" ? googleConfig : tokkoConfig;

      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          config,
          tenant_id: tenantId,
        }),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Error al probar conexión",
      });
      toast.error("Error al probar conexión");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const config = type === "GOOGLE_SHEETS" ? googleConfig : tokkoConfig;

      // Validate required fields
      if (type === "GOOGLE_SHEETS") {
        if (!googleConfig.spreadsheet_id || !googleConfig.service_account_json) {
          toast.error("Completá todos los campos requeridos");
          setIsSaving(false);
          return;
        }
      } else {
        if (!tokkoConfig.api_key) {
          toast.error("El API Key es requerido");
          setIsSaving(false);
          return;
        }
      }

      if (existingIntegrationId) {
        // Update existing
        const { error } = await supabase
          .from("tenant_integrations")
          .update({
            config,
            status: "ACTIVE",
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingIntegrationId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase.from("tenant_integrations").insert({
          tenant_id: tenantId,
          integration_type: type,
          name: type === "GOOGLE_SHEETS" ? "Google Sheets" : "Tokko CRM",
          config,
          status: "ACTIVE",
          is_active: true,
        });

        if (error) throw error;
      }

      toast.success("Integración guardada correctamente");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving integration:", error);
      toast.error("Error al guardar integración");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets({ ...showSecrets, [key]: !showSecrets[key] });
  };

  const modalTitle =
    type === "GOOGLE_SHEETS"
      ? "Configurar Google Sheets"
      : "Configurar Tokko CRM";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            isLoading={isTesting}
            disabled={isSaving}
          >
            Probar conexión
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            Guardar
          </Button>
        </>
      }
    >
      {/* Test Result Badge */}
      {testResult && (
        <div className="mb-4">
          <Alert
            variant={testResult.success ? "success" : "error"}
            title={testResult.success ? "Conexión exitosa" : "Error de conexión"}
          >
            {testResult.message}
          </Alert>
        </div>
      )}

      {type === "GOOGLE_SHEETS" ? (
        <GoogleSheetsForm
          config={googleConfig}
          onChange={setGoogleConfig}
          showSecrets={showSecrets}
          toggleSecret={toggleSecret}
        />
      ) : (
        <TokkoForm
          config={tokkoConfig}
          onChange={setTokkoConfig}
          showSecrets={showSecrets}
          toggleSecret={toggleSecret}
        />
      )}
    </Modal>
  );
}

// ============================================
// Google Sheets Form
// ============================================

interface GoogleSheetsFormProps {
  config: GoogleSheetsFormConfig;
  onChange: (config: GoogleSheetsFormConfig) => void;
  showSecrets: Record<string, boolean>;
  toggleSecret: (key: string) => void;
}

function GoogleSheetsForm({
  config,
  onChange,
  showSecrets,
  toggleSecret,
}: GoogleSheetsFormProps) {
  const toast = useToast();

  const handleCopyServiceAccountEmail = async () => {
    try {
      const parsed = JSON.parse(config.service_account_json);
      if (parsed.client_email) {
        await copyToClipboard(parsed.client_email);
        toast.success("Email copiado al portapapeles");
      }
    } catch {
      toast.error("No se pudo extraer el email del service account");
    }
  };

  // Extract service account email for display
  let serviceAccountEmail: string | null = null;
  try {
    const parsed = JSON.parse(config.service_account_json);
    serviceAccountEmail = parsed.client_email;
  } catch {
    // Invalid JSON, ignore
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>
            Creá un <strong>Service Account</strong> en Google Cloud Console
          </li>
          <li>Descargá el archivo JSON de credenciales</li>
          <li>Compartí el spreadsheet con el email del service account</li>
        </ol>
      </Alert>

      <Input
        label="Spreadsheet ID"
        value={config.spreadsheet_id}
        onChange={(e) => onChange({ ...config, spreadsheet_id: e.target.value })}
        placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
        hint="Lo encontrás en la URL del spreadsheet: docs.google.com/spreadsheets/d/[ID]/edit"
        required
      />

      <Input
        label="Nombre de la hoja"
        value={config.sheet_name}
        onChange={(e) => onChange({ ...config, sheet_name: e.target.value })}
        placeholder="Leads"
        hint="El nombre de la pestaña dentro del spreadsheet"
      />

      <div>
        <TextArea
          label="Service Account JSON"
          value={config.service_account_json}
          onChange={(e) =>
            onChange({ ...config, service_account_json: e.target.value })
          }
          placeholder='{"type": "service_account", "project_id": "...", ...}'
          rows={6}
          required
        />
        {serviceAccountEmail && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-slate-400">Email del service account:</span>
            <code className="px-2 py-0.5 rounded bg-card-border text-slate-300">
              {serviceAccountEmail}
            </code>
            <button
              type="button"
              onClick={handleCopyServiceAccountEmail}
              className="p-1 rounded hover:bg-card-border transition-colors"
              title="Copiar email"
            >
              <Copy className="h-4 w-4 text-slate-400 hover:text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Tokko Form
// ============================================

interface TokkoFormProps {
  config: TokkoFormConfig;
  onChange: (config: TokkoFormConfig) => void;
  showSecrets: Record<string, boolean>;
  toggleSecret: (key: string) => void;
}

function TokkoForm({
  config,
  onChange,
  showSecrets,
  toggleSecret,
}: TokkoFormProps) {
  return (
    <div className="space-y-4">
      <Alert variant="info">
        <p className="text-sm">
          Obené tu API Key desde el panel de Tokko en{" "}
          <strong>Configuración → Integraciones → API</strong>
        </p>
      </Alert>

      <Input
        label="API Key"
        type={showSecrets.api_key ? "text" : "password"}
        value={config.api_key}
        onChange={(e) => onChange({ ...config, api_key: e.target.value })}
        placeholder="••••••••••••••••"
        required
        rightIcon={
          <button type="button" onClick={() => toggleSecret("api_key")}>
            {showSecrets.api_key ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        }
      />

      <Input
        label="URL de la API"
        value={config.api_url}
        onChange={(e) => onChange({ ...config, api_url: e.target.value })}
        placeholder="https://www.tokkobroker.com/api/v1"
        hint="Normalmente no hace falta cambiar esto"
      />

      <a
        href="https://developers.tokkobroker.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300"
      >
        Ver documentación de Tokko
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

