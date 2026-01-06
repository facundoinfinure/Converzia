"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatDate } from "@/lib/utils";
import { IntegrationConfigModal } from "@/components/admin/IntegrationConfigModal";

type IntegrationType = "GOOGLE_SHEETS" | "TOKKO";

interface TenantIntegration {
  id: string;
  tenant_id: string;
  integration_type: IntegrationType;
  name: string;
  status: string;
  is_active: boolean;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_error: string | null;
  last_sync_status: string | null;
}

function IntegrationCard({
  title,
  description,
  icon: Icon,
  integration,
  isLoading,
  onConfigure,
  integrationType,
  googleConnected,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  integration?: TenantIntegration;
  isLoading: boolean;
  onConfigure: () => void;
  integrationType: IntegrationType;
  googleConnected?: boolean;
}) {
  // For Google Sheets, check both integration entry and OAuth connection
  const isConfigured = integrationType === "GOOGLE_SHEETS" 
    ? (!!integration || googleConnected === true)
    : !!integration;
  
  const isActive = integration?.is_active;
  const hasError = integration?.status === "ERROR";
  
  // Determine visual state
  const isFullyConfigured = isConfigured && (isActive || (integrationType === "GOOGLE_SHEETS" && googleConnected));
  const statusVariant = hasError ? "danger" : isActive ? "success" : isConfigured ? "secondary" : undefined;

  return (
    <Card className={cn(
      "transition-all duration-200",
      isConfigured && "border-[var(--accent-primary)]/30 shadow-md",
      isActive && "border-[var(--success)]/50 shadow-lg shadow-[var(--success)]/10",
      hasError && "border-[var(--error)]/50"
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
              isConfigured 
                ? "bg-[var(--accent-primary)]/10" 
                : "bg-[var(--bg-tertiary)]"
            )}>
              <Icon className={cn(
                "h-5 w-5 transition-colors",
                isConfigured 
                  ? "text-[var(--accent-primary)]" 
                  : "text-[var(--text-secondary)]"
              )} />
            </div>
            <CardTitle>{title}</CardTitle>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
          ) : isConfigured ? (
            hasError ? (
              <Badge variant="danger" dot>Error</Badge>
            ) : isActive ? (
              <Badge variant="success" dot>Activo</Badge>
            ) : integrationType === "GOOGLE_SHEETS" && googleConnected ? (
              <Badge variant="secondary" dot>Conectado</Badge>
            ) : (
              <Badge variant="secondary" dot>Configurado</Badge>
            )
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[var(--text-tertiary)] text-sm mb-4">{description}</p>
        
        {isConfigured ? (
          <div className="space-y-3">
            {integrationType === "GOOGLE_SHEETS" && googleConnected && !integration && (
              <div className="p-3 rounded-lg bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/20">
                <p className="text-xs text-[var(--text-secondary)] font-medium">
                  ✓ Cuenta de Google conectada
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Configurá el spreadsheet para activar la integración
                </p>
              </div>
            )}
            {integration?.last_sync_at && (
              <p className="text-xs text-[var(--text-tertiary)]">
                Última sync: {formatDate(integration.last_sync_at)}
              </p>
            )}
            {integration?.last_error && (
              <Alert variant="error" className="text-xs">
                {integration.last_error}
              </Alert>
            )}
            <Button 
              variant={isActive ? "primary" : "secondary"} 
              fullWidth 
              onClick={onConfigure}
            >
              {isActive ? "Editar configuración" : "Completar configuración"}
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-[var(--text-tertiary)] mb-4">No configurado</p>
            <Button variant="secondary" fullWidth onClick={onConfigure}>
              Configurar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PortalIntegrationsPage() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState<boolean | undefined>(undefined);
  const [integrationModal, setIntegrationModal] = useState<{
    type: IntegrationType;
    existingConfig?: Record<string, unknown>;
    existingId?: string;
  } | null>(null);

  // Fetch integrations
  const fetchIntegrations = useCallback(async () => {
    if (!activeTenantId) return;
    setIntegrationsLoading(true);
    
    try {
      // Fetch tenant integrations
      const { data, error } = await queryWithTimeout(
        supabase
          .from("tenant_integrations")
          .select("*")
          .eq("tenant_id", activeTenantId),
        8000,
        "fetch integrations",
        false
      );
      
      if (error) {
        console.error("Error fetching integrations:", error);
        toast.error("Error al cargar integraciones");
      } else {
        setIntegrations(Array.isArray(data) ? data : []);
      }

      // Check Google OAuth connection status
      try {
        const googleResponse = await fetch(
          `/api/integrations/google/spreadsheets?tenant_id=${activeTenantId}`
        );
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          setGoogleConnected(googleData.connected === true);
        } else {
          setGoogleConnected(false);
        }
      } catch (googleError) {
        // Silently fail - Google connection check is optional
        setGoogleConnected(false);
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
      toast.error("Error al cargar integraciones");
    } finally {
      setIntegrationsLoading(false);
    }
  }, [activeTenantId, supabase, toast]);

  // Handle OAuth callback success message
  useEffect(() => {
    const googleConnected = searchParams.get("google_connected");
    const error = searchParams.get("error");

    if (googleConnected === "true") {
      toast.success("Cuenta de Google conectada correctamente");
      router.replace("/portal/integrations", { scroll: false });
      fetchIntegrations();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        google_auth_denied: "Acceso a Google denegado",
        google_auth_invalid: "Error de autenticación con Google",
        google_auth_no_tokens: "No se recibieron tokens de Google",
        google_auth_save_failed: "Error al guardar la conexión",
        google_not_configured: "Google OAuth no está configurado",
        google_auth_failed: "Error de autenticación con Google",
      };
      toast.error(errorMessages[error] || "Error de autenticación");
      router.replace("/portal/integrations", { scroll: false });
    }
  }, [searchParams, router, toast, fetchIntegrations]);

  useEffect(() => {
    if (activeTenantId) {
      fetchIntegrations();
    }
  }, [activeTenantId, fetchIntegrations]);

  const getIntegration = (type: IntegrationType): TenantIntegration | undefined => {
    return integrations.find((i) => i.integration_type === type);
  };

  const openIntegrationModal = (type: IntegrationType) => {
    const existing = getIntegration(type);
    setIntegrationModal({
      type,
      existingConfig: existing?.config,
      existingId: existing?.id,
    });
  };

  if (integrationsLoading && integrations.length === 0) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Integraciones"
        description="Configurá cómo se entregan los leads calificados a tus sistemas"
        breadcrumbs={[
          { label: "Portal", href: "/portal" },
          { label: "Integraciones" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IntegrationCard
          title="Google Sheets"
          description="Envía leads calificados automáticamente a un spreadsheet de Google Sheets"
          icon={FileSpreadsheet}
          integration={getIntegration("GOOGLE_SHEETS")}
          isLoading={integrationsLoading}
          onConfigure={() => openIntegrationModal("GOOGLE_SHEETS")}
          integrationType="GOOGLE_SHEETS"
          googleConnected={googleConnected}
        />

        <IntegrationCard
          title="Tokko CRM"
          description="Sincroniza leads con tu cuenta de Tokko Broker"
          icon={Building2}
          integration={getIntegration("TOKKO")}
          isLoading={integrationsLoading}
          onConfigure={() => openIntegrationModal("TOKKO")}
          integrationType="TOKKO"
        />
      </div>

      {/* Integration Config Modal */}
      {integrationModal && activeTenantId && (
        <IntegrationConfigModal
          isOpen={true}
          onClose={() => setIntegrationModal(null)}
          onSuccess={fetchIntegrations}
          type={integrationModal.type}
          tenantId={activeTenantId}
          existingConfig={integrationModal.existingConfig as any}
          existingIntegrationId={integrationModal.existingId}
        />
      )}
    </PageContainer>
  );
}
