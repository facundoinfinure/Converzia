"use client";

import { useState } from "react";
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
  });

  // Show/hide secrets
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<Record<string, "success" | "error" | "testing" | null>>({});

  // Initialize form values when settings load
  useState(() => {
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
      });
    }
  });

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

      <Tabs defaultValue="meta">
        <TabsList>
          <TabTrigger value="meta" icon={<Facebook className="h-4 w-4" />}>
            Meta / Facebook
          </TabTrigger>
          <TabTrigger value="whatsapp" icon={<MessageCircle className="h-4 w-4" />}>
            WhatsApp
          </TabTrigger>
          <TabTrigger value="chatwoot" icon={<Webhook className="h-4 w-4" />}>
            Chatwoot
          </TabTrigger>
          <TabTrigger value="openai" icon={<Bot className="h-4 w-4" />}>
            OpenAI
          </TabTrigger>
          <TabTrigger value="prompts" icon={<Settings className="h-4 w-4" />}>
            Prompts
          </TabTrigger>
        </TabsList>

        {/* Meta Settings */}
        <TabContent value="meta">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Meta / Facebook Lead Ads</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
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
        </TabContent>

        {/* WhatsApp Settings */}
        <TabContent value="whatsapp">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>WhatsApp Business API</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
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
        </TabContent>

        {/* Chatwoot Settings */}
        <TabContent value="chatwoot">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Chatwoot</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
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
        </TabContent>

        {/* OpenAI Settings */}
        <TabContent value="openai">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>OpenAI</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
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
        </TabContent>

        {/* Prompts Settings (Converzia Admin only via RLS) */}
        <TabContent value="prompts">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Prompts (Admin)</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Estos prompts afectan el comportamiento del bot para todos los tenants. Los tenants no pueden editar esto.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="info">
                Sugerencia: guardalo en formato Markdown. En runtime se interpolan variables como <code>{"{{tenant_name}}"}</code>.
              </Alert>
              <TextArea
                label="System prompt - Calificación (Markdown)"
                value={promptSettings.qualification_system_prompt_md}
                onChange={(e) =>
                  setPromptSettings({ ...promptSettings, qualification_system_prompt_md: e.target.value })
                }
                rows={18}
                placeholder="Pegá acá el prompt (Markdown)"
              />
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                onClick={() => setPromptSettings({ qualification_system_prompt_md: "" })}
                disabled={isSaving}
              >
                Reset (usar prompt por defecto del repo)
              </Button>
              <Button onClick={() => handleSave("prompts")} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                Guardar
              </Button>
            </CardFooter>
          </Card>
        </TabContent>
      </Tabs>
    </PageContainer>
  );
}

