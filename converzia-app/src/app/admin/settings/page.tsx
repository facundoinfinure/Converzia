"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Facebook,
  MessageCircle,
  Bot,
  Webhook,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Palette,
  RefreshCw,
  Unlink,
  BarChart3,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useSettings, useSettingsMutations } from "@/lib/hooks/use-settings";
import { TextArea } from "@/components/ui/TextArea";
import { ThemeSetting } from "@/components/ui/ThemeToggle";

export default function SettingsPage() {
  const toast = useToast();
  const { settings, rawSettings, isLoading, refetch } = useSettings();
  const { updateSettings, testConnection, isLoading: isSaving } = useSettingsMutations();

  // Form states
  const [metaSettings, setMetaSettings] = useState({
    meta_app_id: "",
    meta_app_secret: "",
    meta_page_access_token: "",
    meta_webhook_verify_token: "",
  });

  const [whatsappSettings, setWhatsappSettings] = useState({
    whatsapp_phone_number_id: "",
    whatsapp_business_account_id: "",
    whatsapp_access_token: "",
  });

  const [chatwootSettings, setChatwootSettings] = useState({
    chatwoot_base_url: "",
    chatwoot_account_id: "",
    chatwoot_api_token: "",
    chatwoot_inbox_id: "",
  });

  const [openaiSettings, setOpenaiSettings] = useState({
    openai_api_key: "",
    openai_model_extraction: "gpt-4o-mini",
    openai_model_response: "gpt-4o",
    openai_model_embedding: "text-embedding-ada-002",
  });

  const [promptSettings, setPromptSettings] = useState({
    qualification_system_prompt_md: "",
    extraction_system_prompt_md: "",
    conversation_summary_prompt_md: "",
    initial_greeting_template: "",
    disqualification_reason_prompt_md: "",
  });

  // Default prompts from files (for reference)
  const [defaultPrompts, setDefaultPrompts] = useState<Record<string, string>>({});
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  // Show/hide secrets
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<Record<string, "success" | "error" | "testing" | null>>({});

  // Unified Meta OAuth state
  const [metaConnected, setMetaConnected] = useState<boolean | null>(null);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaChecking, setMetaChecking] = useState(true); // Loading state
  const [metaConfig, setMetaConfig] = useState<{
    user_name?: string;
    ad_accounts?: any[];
    pages?: any[];
    whatsapp_business_accounts?: any[];
    selected_page_id?: string;
    selected_waba_id?: string;
    selected_phone_number_id?: string;
  } | null>(null);

  // Check Meta OAuth connection
  const checkMetaConnection = useCallback(async () => {
    setMetaChecking(true);
    try {
      const response = await fetch("/api/integrations/meta/config");
      const data = await response.json();
      
      console.log("Meta config response:", data); // Debug log
      
      if (response.ok && data.connected) {
        setMetaConnected(true);
        setMetaConfig(data);
      } else {
        setMetaConnected(false);
        setMetaConfig(null);
      }
    } catch (error) {
      console.error("Error checking Meta connection:", error);
      setMetaConnected(false);
      setMetaConfig(null);
    } finally {
      setMetaChecking(false);
    }
  }, []);

  // Connect Meta (unified OAuth)
  const handleConnectMeta = async () => {
    setMetaConnecting(true);
    try {
      const response = await fetch("/api/integrations/meta/auth");
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Error al iniciar conexión con Meta");
        setMetaConnecting(false);
      }
    } catch {
      toast.error("Error al conectar con Meta");
      setMetaConnecting(false);
    }
  };

  // Disconnect Meta
  const handleDisconnectMeta = async () => {
    try {
      const response = await fetch("/api/integrations/meta/disconnect", {
        method: "POST",
      });
      
      if (response.ok) {
        setMetaConnected(false);
        setMetaConfig(null);
        toast.success("Meta desconectado correctamente");
      } else {
        toast.error("Error al desconectar Meta");
      }
    } catch {
      toast.error("Error al desconectar Meta");
    }
  };

  // Update Meta config selections
  const handleUpdateMetaConfig = async (updates: {
    selected_page_id?: string;
    selected_waba_id?: string;
    selected_phone_number_id?: string;
  }) => {
    try {
      const response = await fetch("/api/integrations/meta/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        setMetaConfig((prev) => prev ? { ...prev, ...updates } : null);
        toast.success("Configuración actualizada");
      } else {
        toast.error("Error al actualizar configuración");
      }
    } catch {
      toast.error("Error al actualizar configuración");
    }
  };

  // Check Meta on mount and handle URL params
  useEffect(() => {
    checkMetaConnection();
    
    // Handle OAuth callback params
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("meta_success") === "true") {
      toast.success("¡Meta conectado correctamente!");
      checkMetaConnection();
      window.history.replaceState({}, "", "/admin/settings");
    }
    if (searchParams.get("meta_error")) {
      const error = searchParams.get("meta_error");
      toast.error(`Error al conectar Meta: ${error}`);
      window.history.replaceState({}, "", "/admin/settings");
    }
  }, [checkMetaConnection, toast]);

  // Fetch default prompts from files
  const fetchDefaultPrompts = async () => {
    setLoadingDefaults(true);
    try {
      const response = await fetch("/api/settings/default-prompts");
      const result = await response.json();
      if (result.success) {
        setDefaultPrompts(result.data);
      }
    } catch (error) {
      console.error("Error fetching default prompts:", error);
    } finally {
      setLoadingDefaults(false);
    }
  };

  // Load default prompts on mount
  useEffect(() => {
    fetchDefaultPrompts();
  }, []);

  // Initialize form values when settings load
  useEffect(() => {
    if (settings) {
      setMetaSettings({
        meta_app_id: settings.meta_app_id || "",
        meta_app_secret: settings.meta_app_secret || "",
        meta_page_access_token: settings.meta_page_access_token || "",
        meta_webhook_verify_token: settings.meta_webhook_verify_token || "",
      });
      setWhatsappSettings({
        whatsapp_phone_number_id: settings.whatsapp_phone_number_id || "",
        whatsapp_business_account_id: settings.whatsapp_business_account_id || "",
        whatsapp_access_token: settings.whatsapp_access_token || "",
      });
      setChatwootSettings({
        chatwoot_base_url: settings.chatwoot_base_url || "",
        chatwoot_account_id: settings.chatwoot_account_id || "",
        chatwoot_api_token: settings.chatwoot_api_token || "",
        chatwoot_inbox_id: settings.chatwoot_inbox_id || "",
      });
      setOpenaiSettings({
        openai_api_key: settings.openai_api_key || "",
        openai_model_extraction: settings.openai_model_extraction || "gpt-4o-mini",
        openai_model_response: settings.openai_model_response || "gpt-4o",
        openai_model_embedding: settings.openai_model_embedding || "text-embedding-ada-002",
      });
      setPromptSettings({
        qualification_system_prompt_md: (settings as any).qualification_system_prompt_md || "",
        extraction_system_prompt_md: (settings as any).extraction_system_prompt_md || "",
        conversation_summary_prompt_md: (settings as any).conversation_summary_prompt_md || "",
        initial_greeting_template: (settings as any).initial_greeting_template || "",
        disqualification_reason_prompt_md: (settings as any).disqualification_reason_prompt_md || "",
      });
    }
  }, [settings]);

  // Load defaults into empty fields when both settings and defaults are loaded
  const loadDefaultsIntoEmptyFields = () => {
    setPromptSettings((prev) => ({
      qualification_system_prompt_md: prev.qualification_system_prompt_md || defaultPrompts.qualification_system_prompt_md || "",
      extraction_system_prompt_md: prev.extraction_system_prompt_md || defaultPrompts.extraction_system_prompt_md || "",
      conversation_summary_prompt_md: prev.conversation_summary_prompt_md || defaultPrompts.conversation_summary_prompt_md || "",
      initial_greeting_template: prev.initial_greeting_template || defaultPrompts.initial_greeting_template || "",
      disqualification_reason_prompt_md: prev.disqualification_reason_prompt_md || defaultPrompts.disqualification_reason_prompt_md || "",
    }));
  };

  const handleSave = async (category: string) => {
    let updates: Record<string, any> = {};

    switch (category) {
      case "meta":
        updates = metaSettings;
        break;
      case "whatsapp":
        updates = whatsappSettings;
        break;
      case "chatwoot":
        updates = chatwootSettings;
        break;
      case "ai":
        updates = openaiSettings;
        break;
      case "prompts":
        updates = promptSettings;
        break;
    }

    try {
      await updateSettings(updates);
      toast.success("Configuración guardada correctamente");
      refetch();
    } catch (error) {
      toast.error("Error al guardar la configuración");
    }
  };

  const handleTestConnection = async (type: "meta" | "whatsapp" | "chatwoot" | "openai") => {
    setConnectionStatus({ ...connectionStatus, [type]: "testing" });

    const result = await testConnection(type);

    setConnectionStatus({
      ...connectionStatus,
      [type]: result.success ? "success" : "error",
    });

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets({ ...showSecrets, [key]: !showSecrets[key] });
  };

  const getInputType = (key: string) => {
    const isSecret = rawSettings.find((s) => s.key === key)?.is_secret;
    if (!isSecret) return "text";
    return showSecrets[key] ? "text" : "password";
  };

  const ConnectionBadge = ({ status }: { status: "success" | "error" | "testing" | null }) => {
    if (status === "testing") {
      return (
        <Badge variant="info">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Probando...
        </Badge>
      );
    }
    if (status === "success") {
      return (
        <Badge variant="success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Conectado
        </Badge>
      );
    }
    if (status === "error") {
      return (
        <Badge variant="danger">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Configuración"
        description="Configurá las integraciones y parámetros de la plataforma"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Configuración" },
        ]}
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabTrigger value="general" icon={<Palette className="h-4 w-4" />}>
            General
          </TabTrigger>
          <TabTrigger value="integrations" icon={<Webhook className="h-4 w-4" />}>
            Integraciones
          </TabTrigger>
        </TabsList>

        {/* General Tab - Preferences + Prompts */}
        <TabContent value="general">
          <div className="space-y-6">
            {/* Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Preferencias</CardTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  Personalizá tu experiencia en la plataforma
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <ThemeSetting />
              </CardContent>
            </Card>

            {/* Prompts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <CardTitle>Prompts del bot</CardTitle>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                      Configuración del comportamiento del bot para todos los tenants
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadDefaultsIntoEmptyFields}
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                    disabled={loadingDefaults}
                  >
                    Cargar defaults
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Qualification Prompt */}
                <div>
                  <TextArea
                    label="System prompt - Calificación de leads"
                    value={promptSettings.qualification_system_prompt_md}
                    onChange={(e) =>
                      setPromptSettings({ ...promptSettings, qualification_system_prompt_md: e.target.value })
                    }
                    rows={10}
                    placeholder="Prompt que define cómo el bot califica leads..."
                    hint="Variables: {{tenant_name}}, {{offer_name}}, {{lead_name}}, {{qualification_fields}}, {{rag_context}}"
                  />
                </div>

                {/* Extraction Prompt */}
                <div>
                  <TextArea
                    label="System prompt - Extracción de campos"
                    value={promptSettings.extraction_system_prompt_md}
                    onChange={(e) =>
                      setPromptSettings({ ...promptSettings, extraction_system_prompt_md: e.target.value })
                    }
                    rows={8}
                    placeholder="Prompt que define cómo extraer campos del mensaje del usuario..."
                    hint="Define los campos a extraer (nombre, presupuesto, zona, etc.) y las reglas de extracción."
                  />
                </div>

                {/* Conversation Summary Prompt */}
                <div>
                  <TextArea
                    label="System prompt - Resumen de conversación"
                    value={promptSettings.conversation_summary_prompt_md}
                    onChange={(e) =>
                      setPromptSettings({ ...promptSettings, conversation_summary_prompt_md: e.target.value })
                    }
                    rows={6}
                    placeholder="Prompt para generar resúmenes de conversaciones..."
                    hint="Se usa para generar notas automáticas para el equipo comercial."
                  />
                </div>

                {/* Disqualification Reason Prompt */}
                <div>
                  <TextArea
                    label="System prompt - Motivos de descalificación"
                    value={promptSettings.disqualification_reason_prompt_md}
                    onChange={(e) =>
                      setPromptSettings({ ...promptSettings, disqualification_reason_prompt_md: e.target.value })
                    }
                    rows={8}
                    placeholder="Prompt para determinar si un lead debe ser descalificado y por qué motivo..."
                    hint="Define las categorías de descalificación (PRICE_TOO_HIGH, WRONG_ZONE, NOT_INTERESTED, etc.)"
                  />
                </div>

                {/* Initial Greeting Template */}
                <div>
                  <TextArea
                    label="Plantilla de saludo inicial"
                    value={promptSettings.initial_greeting_template}
                    onChange={(e) =>
                      setPromptSettings({ ...promptSettings, initial_greeting_template: e.target.value })
                    }
                    rows={4}
                    placeholder="Hola {{lead_name}}! Gracias por tu interés en {{offer_name}}..."
                    hint="Variables: {{lead_name}}, {{offer_name}}, {{tenant_name}}"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => handleSave("prompts")} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                  Guardar prompts
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabContent>

        {/* Integrations Tab - All integrations in one view */}
        <TabContent value="integrations">
          <div className="space-y-6">
            
            {/* Unified Meta Integration (Marketing API + Lead Ads + WhatsApp) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#1877F2]" fill="currentColor">
                      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>Meta Business</CardTitle>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                      Conexión unificada para Ads, Lead Ads y WhatsApp
                    </p>
                  </div>
                </div>
                {metaChecking && (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Verificando...
                  </Badge>
                )}
                {!metaChecking && metaConnected === true && (
                  <Badge variant="success" dot>
                    Conectado
                  </Badge>
                )}
                {!metaChecking && metaConnected === false && (
                  <Badge variant="secondary">
                    No conectado
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {/* Loading state */}
                {metaChecking && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
                    <span className="ml-3 text-[var(--text-secondary)]">Verificando conexión...</span>
                  </div>
                )}

                {!metaChecking && metaConnected === true && metaConfig ? (
                  <div className="space-y-6">
                    {/* User info */}
                    <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            Conectado como {metaConfig.user_name || "Usuario de Meta"}
                          </p>
                          <p className="text-sm text-[var(--text-tertiary)]">
                            {metaConfig.ad_accounts?.length || 0} Ad Accounts • {metaConfig.pages?.length || 0} Pages • {metaConfig.whatsapp_business_accounts?.length || 0} WhatsApp
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={checkMetaConnection}
                          leftIcon={<RefreshCw className="h-4 w-4" />}
                        >
                          Actualizar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleDisconnectMeta}
                          leftIcon={<Unlink className="h-4 w-4" />}
                        >
                          Desconectar
                        </Button>
                      </div>
                    </div>

                    {/* Ad Accounts */}
                    {metaConfig.ad_accounts && metaConfig.ad_accounts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Cuentas Publicitarias (Marketing API)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {metaConfig.ad_accounts.map((acc: any) => (
                            <Badge key={acc.id} variant="info" size="sm">
                              {acc.name || acc.account_id || acc.id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pages for Lead Ads */}
                    {metaConfig.pages && metaConfig.pages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                          <Facebook className="h-4 w-4" />
                          Páginas (Lead Ads)
                        </h4>
                        <div className="space-y-2">
                          {metaConfig.pages.map((page: any) => (
                            <label
                              key={page.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                metaConfig.selected_page_id === page.id
                                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary-light)]"
                                  : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
                              }`}
                            >
                              <input
                                type="radio"
                                name="selected_page"
                                checked={metaConfig.selected_page_id === page.id}
                                onChange={() => handleUpdateMetaConfig({ selected_page_id: page.id })}
                                className="sr-only"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-[var(--text-primary)]">{page.name}</p>
                                <p className="text-xs text-[var(--text-tertiary)]">{page.category || "Página"}</p>
                              </div>
                              {metaConfig.selected_page_id === page.id && (
                                <CheckCircle className="h-5 w-5 text-[var(--accent-primary)]" />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* WhatsApp Business Accounts */}
                    {metaConfig.whatsapp_business_accounts && metaConfig.whatsapp_business_accounts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp Business
                        </h4>
                        <div className="space-y-2">
                          {metaConfig.whatsapp_business_accounts.map((waba: any) => (
                            <div key={waba.id} className="space-y-2">
                              <label
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  metaConfig.selected_waba_id === waba.id
                                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary-light)]"
                                    : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="selected_waba"
                                  checked={metaConfig.selected_waba_id === waba.id}
                                  onChange={() => handleUpdateMetaConfig({ selected_waba_id: waba.id })}
                                  className="sr-only"
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-[var(--text-primary)]">{waba.name}</p>
                                  <p className="text-xs text-[var(--text-tertiary)]">{waba.business_name || waba.id}</p>
                                </div>
                                {metaConfig.selected_waba_id === waba.id && (
                                  <CheckCircle className="h-5 w-5 text-[var(--accent-primary)]" />
                                )}
                              </label>
                              
                              {/* Phone numbers for this WABA */}
                              {metaConfig.selected_waba_id === waba.id && waba.phone_numbers && waba.phone_numbers.length > 0 && (
                                <div className="ml-6 space-y-2">
                                  {waba.phone_numbers.map((phone: any) => (
                                    <label
                                      key={phone.id}
                                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                                        metaConfig.selected_phone_number_id === phone.id
                                          ? "border-green-500 bg-green-500/10"
                                          : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="selected_phone"
                                        checked={metaConfig.selected_phone_number_id === phone.id}
                                        onChange={() => handleUpdateMetaConfig({ selected_phone_number_id: phone.id })}
                                        className="sr-only"
                                      />
                                      <div className="flex-1">
                                        <p className="text-sm text-[var(--text-primary)]">{phone.display_phone_number}</p>
                                        <p className="text-xs text-[var(--text-tertiary)]">{phone.verified_name}</p>
                                      </div>
                                      {metaConfig.selected_phone_number_id === phone.id && (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      )}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No assets warning */}
                    {(!metaConfig.pages || metaConfig.pages.length === 0) && 
                     (!metaConfig.whatsapp_business_accounts || metaConfig.whatsapp_business_accounts.length === 0) && (
                      <Alert variant="warning">
                        No se encontraron Pages ni WhatsApp Business Accounts. 
                        Verificá que tu app de Meta tenga los permisos necesarios aprobados.
                      </Alert>
                    )}
                  </div>
                ) : null}

                {!metaChecking && !metaConnected && (
                  <div className="space-y-4">
                    <p className="text-[var(--text-secondary)]">
                      Conectá tu cuenta de Meta Business para poder:
                    </p>
                    <ul className="list-disc list-inside text-sm text-[var(--text-tertiary)] space-y-1">
                      <li><strong>Marketing API:</strong> Mapear anuncios a ofertas y sincronizar costos</li>
                      <li><strong>Lead Ads:</strong> Recibir leads de formularios de Facebook e Instagram</li>
                      <li><strong>WhatsApp:</strong> Enviar mensajes y gestionar conversaciones</li>
                    </ul>
                    <Button
                      onClick={handleConnectMeta}
                      isLoading={metaConnecting}
                      leftIcon={
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
                        </svg>
                      }
                    >
                      Conectar con Meta
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Advanced Meta Settings (Manual fallback) */}
            <Card>
              <CardHeader>
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div>
                      <CardTitle className="text-sm">Configuración Avanzada de Meta</CardTitle>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        App ID, Secret y Webhook (solo si OAuth no funciona)
                      </p>
                    </div>
                    <svg className="h-5 w-5 text-[var(--text-tertiary)] group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="pt-4 space-y-4">
                    <Alert variant="info" size="sm">
                      Estos campos son opcionales si usás OAuth. Solo necesarios si tu app de Meta no tiene los permisos aprobados.
                    </Alert>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="App ID"
                        value={metaSettings.meta_app_id}
                        onChange={(e) => setMetaSettings({ ...metaSettings, meta_app_id: e.target.value })}
                        placeholder="123456789012345"
                      />
                      <Input
                        label="App Secret"
                        type={getInputType("meta_app_secret")}
                        value={metaSettings.meta_app_secret}
                        onChange={(e) => setMetaSettings({ ...metaSettings, meta_app_secret: e.target.value })}
                        placeholder="••••••••••••••••"
                        rightIcon={
                          <button type="button" onClick={() => toggleSecret("meta_app_secret")}>
                            {showSecrets.meta_app_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      />
                      <Input
                        label="Webhook Verify Token"
                        value={metaSettings.meta_webhook_verify_token}
                        onChange={(e) => setMetaSettings({ ...metaSettings, meta_webhook_verify_token: e.target.value })}
                        placeholder="my-verify-token"
                        hint="Token para verificar webhooks"
                      />
                    </div>
                    <Alert variant="info" size="sm">
                      <strong>URL del Webhook:</strong>{" "}
                      <code className="bg-card-border px-1 py-0.5 rounded text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/meta-leads</code>
                    </Alert>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestConnection("meta")}
                        disabled={connectionStatus.meta === "testing"}
                      >
                        Probar conexión
                      </Button>
                      <Button size="sm" onClick={() => handleSave("meta")} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                </details>
              </CardHeader>
            </Card>

            {/* Chatwoot Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Chatwoot</CardTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  Configurá la conexión con Chatwoot para gestionar conversaciones
                </p>
              </div>
              <ConnectionBadge status={connectionStatus.chatwoot || null} />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="URL Base"
                  value={chatwootSettings.chatwoot_base_url}
                  onChange={(e) => setChatwootSettings({ ...chatwootSettings, chatwoot_base_url: e.target.value })}
                  placeholder="https://app.chatwoot.com"
                />
                <Input
                  label="Account ID"
                  value={chatwootSettings.chatwoot_account_id}
                  onChange={(e) => setChatwootSettings({ ...chatwootSettings, chatwoot_account_id: e.target.value })}
                  placeholder="1"
                />
                <Input
                  label="API Token"
                  type={getInputType("chatwoot_api_token")}
                  value={chatwootSettings.chatwoot_api_token}
                  onChange={(e) => setChatwootSettings({ ...chatwootSettings, chatwoot_api_token: e.target.value })}
                  placeholder="••••••••••••••••"
                  rightIcon={
                    <button type="button" onClick={() => toggleSecret("chatwoot_api_token")}>
                      {showSecrets.chatwoot_api_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Input
                  label="Inbox ID"
                  value={chatwootSettings.chatwoot_inbox_id}
                  onChange={(e) => setChatwootSettings({ ...chatwootSettings, chatwoot_inbox_id: e.target.value })}
                  placeholder="1"
                  hint="ID del inbox de WhatsApp"
                />
              </div>

              <Alert variant="info">
                <strong>URL del Webhook:</strong>{" "}
                <code className="bg-card-border px-2 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/chatwoot</code>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                onClick={() => handleTestConnection("chatwoot")}
                disabled={connectionStatus.chatwoot === "testing"}
              >
                Probar conexión
              </Button>
              <Button onClick={() => handleSave("chatwoot")} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                Guardar
              </Button>
            </CardFooter>
          </Card>

            {/* OpenAI Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>OpenAI</CardTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  Configurá la API de OpenAI para calificación y respuestas
                </p>
              </div>
              <ConnectionBadge status={connectionStatus.openai || null} />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <Input
                  label="API Key"
                  type={getInputType("openai_api_key")}
                  value={openaiSettings.openai_api_key}
                  onChange={(e) => setOpenaiSettings({ ...openaiSettings, openai_api_key: e.target.value })}
                  placeholder="sk-••••••••••••••••"
                  rightIcon={
                    <button type="button" onClick={() => toggleSecret("openai_api_key")}>
                      {showSecrets.openai_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input
                  label="Modelo para extracción"
                  value={openaiSettings.openai_model_extraction}
                  onChange={(e) => setOpenaiSettings({ ...openaiSettings, openai_model_extraction: e.target.value })}
                  placeholder="gpt-4o-mini"
                  hint="Modelo rápido para extraer campos"
                />
                <Input
                  label="Modelo para respuestas"
                  value={openaiSettings.openai_model_response}
                  onChange={(e) => setOpenaiSettings({ ...openaiSettings, openai_model_response: e.target.value })}
                  placeholder="gpt-4o"
                  hint="Modelo de mayor calidad"
                />
                <Input
                  label="Modelo de embeddings"
                  value={openaiSettings.openai_model_embedding}
                  onChange={(e) => setOpenaiSettings({ ...openaiSettings, openai_model_embedding: e.target.value })}
                  placeholder="text-embedding-ada-002"
                  hint="Para búsqueda RAG"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                onClick={() => handleTestConnection("openai")}
                disabled={connectionStatus.openai === "testing"}
              >
                Probar conexión
              </Button>
              <Button onClick={() => handleSave("ai")} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                Guardar
              </Button>
            </CardFooter>
          </Card>
          </div>
        </TabContent>
      </Tabs>
    </PageContainer>
  );
}

