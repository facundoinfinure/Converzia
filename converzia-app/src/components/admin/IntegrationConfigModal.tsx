"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Plus,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

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
  service_account_json?: string;
}

interface TokkoFormConfig {
  api_key: string;
  api_url: string;
}

interface SpreadsheetInfo {
  id: string;
  name: string;
  url: string;
  sheets: { id: number; title: string }[];
}

interface GoogleConnectionState {
  connected: boolean;
  email: string | null;
  spreadsheets: SpreadsheetInfo[];
  loading: boolean;
  error: string | null;
}

const DEFAULT_GOOGLE_CONFIG: GoogleSheetsFormConfig = {
  spreadsheet_id: "",
  sheet_name: "Leads",
};

const DEFAULT_TOKKO_CONFIG: TokkoFormConfig = {
  api_key: "",
  api_url: "https://www.tokkobroker.com/api/v1",
};

// Google Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    offers_synced: number;
    variants_synced: number;
    errors: string[];
    message?: string;
  } | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Form states
  const [googleConfig, setGoogleConfig] = useState<GoogleSheetsFormConfig>(
    DEFAULT_GOOGLE_CONFIG
  );
  const [tokkoConfig, setTokkoConfig] = useState<TokkoFormConfig>(
    DEFAULT_TOKKO_CONFIG
  );

  // Google OAuth state
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionState>({
    connected: false,
    email: null,
    spreadsheets: [],
    loading: false,
    error: null,
  });

  // Load Google connection status
  const loadGoogleConnection = useCallback(async () => {
    if (type !== "GOOGLE_SHEETS") return;

    setGoogleConnection((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(
        `/api/integrations/google/spreadsheets?tenant_id=${tenantId}`
      );
      const data = await response.json();

      if (data.connected) {
        setGoogleConnection({
          connected: true,
          email: data.email,
          spreadsheets: data.spreadsheets || [],
          loading: false,
          error: null,
        });

        // Load current config if available
        if (data.currentConfig) {
          setGoogleConfig({
            spreadsheet_id: data.currentConfig.spreadsheet_id || "",
            sheet_name: data.currentConfig.sheet_name || "Leads",
          });
        }
      } else {
        setGoogleConnection({
          connected: false,
          email: null,
          spreadsheets: [],
          loading: false,
          error: data.error || null,
        });
      }
    } catch (error) {
      setGoogleConnection({
        connected: false,
        email: null,
        spreadsheets: [],
        loading: false,
        error: "Error al verificar conexión",
      });
    }
  }, [tenantId, type]);

  // Load existing config when modal opens
  useEffect(() => {
    if (isOpen) {
      if (type === "GOOGLE_SHEETS") {
        loadGoogleConnection();
        if (existingConfig) {
          setGoogleConfig(existingConfig as GoogleSheetsFormConfig);
        } else {
          setGoogleConfig(DEFAULT_GOOGLE_CONFIG);
        }
      } else if (type === "TOKKO") {
        if (existingConfig) {
          setTokkoConfig(existingConfig as TokkoFormConfig);
        } else {
          setTokkoConfig(DEFAULT_TOKKO_CONFIG);
        }
      }
      setTestResult(null);
      setShowSecrets({});
    }
  }, [isOpen, existingConfig, type, loadGoogleConnection]);

  const handleGoogleConnect = async () => {
    try {
      // Detect if we're in portal or admin based on current path
      const isPortal = typeof window !== "undefined" && window.location.pathname.startsWith("/portal");
      const returnUrl = isPortal ? "/portal/integrations" : undefined;
      
      const response = await fetch(
        `/api/integrations/google/auth?tenant_id=${tenantId}${
          existingIntegrationId ? `&integration_id=${existingIntegrationId}` : ""
        }${returnUrl ? `&return_url=${encodeURIComponent(returnUrl)}` : ""}`
      );
      const data = await response.json();

      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        toast.error(data.error || "Error al iniciar conexión con Google");
      }
    } catch (error) {
      toast.error("Error al conectar con Google");
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      const response = await fetch("/api/integrations/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      if (response.ok) {
        toast.success("Cuenta de Google desconectada");
        setGoogleConnection({
          connected: false,
          email: null,
          spreadsheets: [],
          loading: false,
          error: null,
        });
        setGoogleConfig(DEFAULT_GOOGLE_CONFIG);
        onSuccess();
      } else {
        toast.error("Error al desconectar cuenta");
      }
    } catch (error) {
      toast.error("Error al desconectar cuenta");
    }
  };

  const handleCreateSpreadsheet = async () => {
    setGoogleConnection((prev) => ({ ...prev, loading: true }));

    try {
      const response = await fetch("/api/integrations/google/spreadsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: `Converzia Leads - ${new Date().toLocaleDateString("es-AR")}`,
        }),
      });

      const data = await response.json();

      if (data.success && data.spreadsheet) {
        toast.success("Spreadsheet creado correctamente");
        
        // Update config with new spreadsheet
        setGoogleConfig({
          spreadsheet_id: data.spreadsheet.id,
          sheet_name: "Leads",
        });

        // Refresh spreadsheet list
        await loadGoogleConnection();
      } else {
        toast.error(data.error || "Error al crear spreadsheet");
      }
    } catch (error) {
      toast.error("Error al crear spreadsheet");
    } finally {
      setGoogleConnection((prev) => ({ ...prev, loading: false }));
    }
  };

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

  const handleSync = async () => {
    if (!existingIntegrationId) {
      toast.error("Guardá la integración primero antes de sincronizar");
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/integrations/tokko/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          force_full_sync: false,
        }),
      });

      const result = await response.json();
      setSyncResult(result);

      if (result.success) {
        toast.success(
          `Sincronización exitosa: ${result.offers_synced} ofertas, ${result.variants_synced} variantes`
        );
      } else {
        toast.error(
          `Error en sincronización: ${result.errors.join(", ")}`
        );
      }
    } catch (error) {
      setSyncResult({
        success: false,
        offers_synced: 0,
        variants_synced: 0,
        errors: ["Error al sincronizar"],
      });
      toast.error("Error al sincronizar ofertas");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const config = type === "GOOGLE_SHEETS" ? googleConfig : tokkoConfig;

      // Validate required fields
      if (type === "GOOGLE_SHEETS") {
        if (!googleConfig.spreadsheet_id) {
          toast.error("Seleccioná un spreadsheet");
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
        // Check if integration already exists (could be created by OAuth flow)
        const { data: existing } = await supabase
          .from("tenant_integrations")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("integration_type", type)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("tenant_integrations")
            .update({
              config,
              status: "ACTIVE",
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

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

  const canSave =
    type === "GOOGLE_SHEETS"
      ? googleConnection.connected && googleConfig.spreadsheet_id
      : tokkoConfig.api_key;

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
          {canSave && (
            <>
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
          )}
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
        <GoogleSheetsOAuthForm
          config={googleConfig}
          onChange={setGoogleConfig}
          connection={googleConnection}
          onConnect={handleGoogleConnect}
          onDisconnect={handleGoogleDisconnect}
          onCreateSpreadsheet={handleCreateSpreadsheet}
          onRefresh={loadGoogleConnection}
        />
      ) : (
        <TokkoForm
          config={tokkoConfig}
          onChange={setTokkoConfig}
          showSecrets={showSecrets}
          toggleSecret={toggleSecret}
          existingIntegrationId={existingIntegrationId}
          isSyncing={isSyncing}
          syncResult={syncResult}
          onSync={handleSync}
        />
      )}
    </Modal>
  );
}

// ============================================
// Google Sheets OAuth Form (New Design)
// ============================================

interface GoogleSheetsOAuthFormProps {
  config: GoogleSheetsFormConfig;
  onChange: (config: GoogleSheetsFormConfig) => void;
  connection: GoogleConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  onCreateSpreadsheet: () => void;
  onRefresh: () => void;
}

function GoogleSheetsOAuthForm({
  config,
  onChange,
  connection,
  onConnect,
  onDisconnect,
  onCreateSpreadsheet,
  onRefresh,
}: GoogleSheetsOAuthFormProps) {
  const selectedSpreadsheet = connection.spreadsheets.find(
    (s) => s.id === config.spreadsheet_id
  );

  // Not connected state
  if (!connection.connected) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <GoogleIcon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Conectá tu cuenta de Google
          </h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Sincronizá tus leads automáticamente a Google Sheets. Solo tenés que
            autorizar el acceso y elegir un spreadsheet.
          </p>

          {connection.loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verificando conexión...</span>
            </div>
          ) : (
            <Button
              onClick={onConnect}
              size="lg"
              className="gap-2"
            >
              <GoogleIcon className="h-5 w-5" />
              Conectar con Google
            </Button>
          )}

          {connection.error && (
            <p className="mt-4 text-sm text-red-400">{connection.error}</p>
          )}
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Cuenta conectada</p>
            <p className="text-sm text-slate-400">{connection.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          className="text-slate-400 hover:text-red-400"
        >
          <Unlink className="h-4 w-4 mr-1" />
          Desconectar
        </Button>
      </div>

      {/* Spreadsheet selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-white">
            Spreadsheet
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={connection.loading}
              className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white disabled:opacity-50"
              title="Actualizar lista"
            >
              <RefreshCw
                className={`h-4 w-4 ${connection.loading ? "animate-spin" : ""}`}
              />
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCreateSpreadsheet}
              disabled={connection.loading}
            >
              <Plus className="h-4 w-4 mr-1" />
              Crear nuevo
            </Button>
          </div>
        </div>

        {connection.loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando spreadsheets...
          </div>
        ) : connection.spreadsheets.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-sm mb-3">
              No tenés spreadsheets en tu cuenta
            </p>
            <Button variant="secondary" onClick={onCreateSpreadsheet}>
              <Plus className="h-4 w-4 mr-1" />
              Crear spreadsheet
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {connection.spreadsheets.map((spreadsheet) => (
              <button
                key={spreadsheet.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    spreadsheet_id: spreadsheet.id,
                    sheet_name:
                      spreadsheet.sheets[0]?.title || config.sheet_name,
                  })
                }
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  config.spreadsheet_id === spreadsheet.id
                    ? "bg-primary-500/20 border-primary-500/50"
                    : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white text-sm">
                    {spreadsheet.name}
                  </span>
                  {config.spreadsheet_id === spreadsheet.id && (
                    <CheckCircle className="h-4 w-4 text-primary-400" />
                  )}
                </div>
                {spreadsheet.sheets.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {spreadsheet.sheets.map((s) => s.title).join(", ")}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Sheet selection (if spreadsheet selected) */}
        {selectedSpreadsheet && selectedSpreadsheet.sheets.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Hoja (pestaña)
            </label>
            <select
              value={config.sheet_name}
              onChange={(e) =>
                onChange({ ...config, sheet_name: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {selectedSpreadsheet.sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.title}>
                  {sheet.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Manual sheet name input (if no sheets info) */}
        {selectedSpreadsheet && selectedSpreadsheet.sheets.length === 0 && (
          <Input
            label="Nombre de la hoja"
            value={config.sheet_name}
            onChange={(e) =>
              onChange({ ...config, sheet_name: e.target.value })
            }
            placeholder="Leads"
            hint="El nombre de la pestaña dentro del spreadsheet"
          />
        )}

        {/* Show link to selected spreadsheet */}
        {selectedSpreadsheet && (
          <a
            href={selectedSpreadsheet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300"
          >
            Abrir spreadsheet
            <ExternalLink className="h-3 w-3" />
          </a>
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
  existingIntegrationId?: string | null;
  isSyncing?: boolean;
  syncResult?: {
    success: boolean;
    offers_synced: number;
    variants_synced: number;
    errors: string[];
    message?: string;
  } | null;
  onSync?: () => void;
}

function TokkoForm({
  config,
  onChange,
  showSecrets,
  toggleSecret,
  existingIntegrationId,
  isSyncing = false,
  syncResult,
  onSync,
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

      {/* Sync Section */}
      {existingIntegrationId && onSync && (
        <div className="pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-white mb-1">
                Sincronizar Ofertas
              </h3>
              <p className="text-xs text-slate-400">
                Sincroniza ofertas y variantes desde Tokko
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={onSync}
              isLoading={isSyncing}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              {isSyncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </div>

          {syncResult && (
            <Alert
              variant={syncResult.success ? "success" : "error"}
              title={
                syncResult.success
                  ? "Sincronización completada"
                  : "Error en sincronización"
              }
            >
              <div className="text-sm space-y-1">
                <p>
                  Ofertas sincronizadas: <strong>{syncResult.offers_synced}</strong>
                </p>
                <p>
                  Variantes sincronizadas: <strong>{syncResult.variants_synced}</strong>
                </p>
                {syncResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-400">Errores:</p>
                    <ul className="list-disc list-inside text-xs text-red-300">
                      {syncResult.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Alert>
          )}
        </div>
      )}

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

