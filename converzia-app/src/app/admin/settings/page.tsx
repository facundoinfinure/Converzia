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

  // Meta Ads OAuth state
  const [metaAdsConnected, setMetaAdsConnected] = useState<boolean | null>(null);
  const [metaAdsConnecting, setMetaAdsConnecting] = useState(false);
  const [metaAdsInfo, setMetaAdsInfo] = useState<{ userName?: string; adAccounts?: any[] } | null>(null);

  // Check Meta Ads OAuth connection
  const checkMetaAdsConnection = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/meta/ads");
      const data = await response.json();
      
      if (response.ok) {
        setMetaAdsConnected(true);
        setMetaAdsInfo({
          adAccounts: data.ad_accounts || [],
        });
      } else {
        setMetaAdsConnected(false);
        setMetaAdsInfo(null);
      }
    } catch {
      setMetaAdsConnected(false);
      setMetaAdsInfo(null);
    }
  }, []);

  // Connect Meta Ads
  const handleConnectMetaAds = async () => {
    setMetaAdsConnecting(true);
    try {
      const response = await fetch("/api/integrations/meta/auth");
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Error al iniciar conexión con Meta Ads");
        setMetaAdsConnecting(false);
      }
    } catch {
      toast.error("Error al conectar con Meta Ads");
      setMetaAdsConnecting(false);
    }
  };

  // Disconnect Meta Ads
  const handleDisconnectMetaAds = async () => {
    try {
      const response = await fetch("/api/integrations/meta/disconnect", {
        method: "POST",
      });
      
      if (response.ok) {
        setMetaAdsConnected(false);
        setMetaAdsInfo(null);
        toast.success("Meta Ads desconectado correctamente");
      } else {
        toast.error("Error al desconectar Meta Ads");
      }
    } catch {
      toast.error("Error al desconectar Meta Ads");
    }
  };

  // Check Meta Ads on mount and handle URL params
  useEffect(() => {
    checkMetaAdsConnection();
    
    // Handle OAuth callback params
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("meta_success") === "true") {
      toast.success("¡Meta Ads conectado correctamente!");
      checkMetaAdsConnection();
      window.history.replaceState({}, "", "/admin/settings");
    }
    if (searchParams.get("meta_error")) {
      const error = searchParams.get("meta_error");
      toast.error(`Error al conectar Meta: ${error}`);
      window.history.replaceState({}, "", "/admin/settings");
    }
  }, [checkMetaAdsConnection, toast]);

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
            
            {/* Meta Ads - Marketing API (OAuth) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#1877F2]" fill="currentColor">
                      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>Meta Ads - Marketing API</CardTitle>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                      Conectá tu cuenta de Meta para mapear anuncios y sincronizar costos
                    </p>
                  </div>
                </div>
                {metaAdsConnected === true && (
                  <Badge variant="success" dot>
                    Conectado
                  </Badge>
                )}
                {metaAdsConnected === false && (
                  <Badge variant="secondary">
                    No conectado
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {metaAdsConnected === true && metaAdsInfo ? (
                  <div className="space-y-4">
                    {/* Connected info */}
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[var(--text-tertiary)]">Cuentas publicitarias disponibles</p>
                          <p className="font-medium text-[var(--text-primary)]">
                            {metaAdsInfo.adAccounts?.length || 0} cuenta(s)
                          </p>
                          {metaAdsInfo.adAccounts && metaAdsInfo.adAccounts.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {metaAdsInfo.adAccounts.slice(0, 3).map((acc: any) => (
                                <Badge key={acc.id} variant="info" size="sm">
                                  {acc.name || acc.account_id || acc.id}
                                </Badge>
                              ))}
                              {metaAdsInfo.adAccounts.length > 3 && (
                                <Badge variant="secondary" size="sm">
                                  +{metaAdsInfo.adAccounts.length - 3} más
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleDisconnectMetaAds}
                          leftIcon={<Unlink className="h-4 w-4" />}
                        >
                          Desconectar
                        </Button>
                      </div>
                    </div>
                    
                    <Alert variant="info">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span>
                          Esta conexión se usa para <strong>mapear anuncios a ofertas</strong> y 
                          <strong> sincronizar costos de publicidad</strong> para analytics.
                        </span>
                      </div>
                    </Alert>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[var(--text-secondary)]">
                      Conectá tu cuenta de Meta Business para poder:
                    </p>
                    <ul className="list-disc list-inside text-sm text-[var(--text-tertiary)] space-y-1">
                      <li>Seleccionar anuncios existentes para mapear a ofertas</li>
                      <li>Sincronizar costos de publicidad (spend, impressions, clicks)</li>
                      <li>Calcular CPL real y margen de ganancia por oferta</li>
                    </ul>
                    <Button
                      onClick={handleConnectMetaAds}
                      isLoading={metaAdsConnecting}
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

            {/* Meta Settings - Lead Ads Webhook */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Meta / Facebook Lead Ads</CardTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  Configurá la integración con Meta para recibir leads de Facebook e Instagram
                </p>
              </div>
              <ConnectionBadge status={connectionStatus.meta || null} />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="App ID"
                  value={metaSettings.meta_app_id}
                  onChange={(e) => setMetaSettings({ ...metaSettings, meta_app_id: e.target.value })}
                  placeholder="123456789012345"
                />
                <div className="relative">
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
                </div>
                <div className="md:col-span-2">
                  <Input
                    label="Page Access Token"
                    type={getInputType("meta_page_access_token")}
                    value={metaSettings.meta_page_access_token}
                    onChange={(e) => setMetaSettings({ ...metaSettings, meta_page_access_token: e.target.value })}
                    placeholder="••••••••••••••••"
                    rightIcon={
                      <button type="button" onClick={() => toggleSecret("meta_page_access_token")}>
                        {showSecrets.meta_page_access_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </div>
                <Input
                  label="Webhook Verify Token"
                  value={metaSettings.meta_webhook_verify_token}
                  onChange={(e) => setMetaSettings({ ...metaSettings, meta_webhook_verify_token: e.target.value })}
                  placeholder="my-verify-token"
                  hint="Token para verificar las solicitudes del webhook"
                />
              </div>

              <Alert variant="info">
                <strong>URL del Webhook:</strong>{" "}
                <code className="bg-card-border px-2 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/meta-leads</code>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                onClick={() => handleTestConnection("meta")}
                disabled={connectionStatus.meta === "testing"}
              >
                Probar conexión
              </Button>
              <Button onClick={() => handleSave("meta")} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                Guardar
              </Button>
            </CardFooter>
          </Card>

            {/* WhatsApp Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>WhatsApp Business API</CardTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  Configurá la conexión con WhatsApp Cloud API
                </p>
              </div>
              <ConnectionBadge status={connectionStatus.whatsapp || null} />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Phone Number ID"
                  value={whatsappSettings.whatsapp_phone_number_id}
                  onChange={(e) => setWhatsappSettings({ ...whatsappSettings, whatsapp_phone_number_id: e.target.value })}
                  placeholder="123456789012345"
                />
                <Input
                  label="Business Account ID"
                  value={whatsappSettings.whatsapp_business_account_id}
                  onChange={(e) => setWhatsappSettings({ ...whatsappSettings, whatsapp_business_account_id: e.target.value })}
                  placeholder="123456789012345"
                />
                <div className="md:col-span-2">
                  <Input
                    label="Access Token"
                    type={getInputType("whatsapp_access_token")}
                    value={whatsappSettings.whatsapp_access_token}
                    onChange={(e) => setWhatsappSettings({ ...whatsappSettings, whatsapp_access_token: e.target.value })}
                    placeholder="••••••••••••••••"
                    rightIcon={
                      <button type="button" onClick={() => toggleSecret("whatsapp_access_token")}>
                        {showSecrets.whatsapp_access_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                onClick={() => handleTestConnection("whatsapp")}
                disabled={connectionStatus.whatsapp === "testing"}
              >
                Probar conexión
              </Button>
              <Button onClick={() => handleSave("whatsapp")} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                Guardar
              </Button>
            </CardFooter>
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

