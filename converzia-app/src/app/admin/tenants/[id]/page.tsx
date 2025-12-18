"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  Package,
  CreditCard,
  Edit,
  MoreHorizontal,
  Mail,
  Phone,
  Globe,
  Calendar,
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { TenantStatusBadge, Badge } from "@/components/ui/Badge";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { Skeleton, FormSkeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useTenant, useTenantMutations } from "@/lib/hooks/use-tenants";
import { formatDate, formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { IntegrationConfigModal } from "@/components/admin/IntegrationConfigModal";
import { useImpersonation } from "@/lib/hooks/use-impersonation";

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
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function TenantDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const { tenant, pricing, isLoading, error, refetch } = useTenant(id);
  const { updateTenantStatus, isLoading: isMutating } = useTenantMutations();
  const [showStatusModal, setShowStatusModal] = useState<"activate" | "suspend" | null>(null);

  // Integration state
  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [integrationModal, setIntegrationModal] = useState<{
    type: IntegrationType;
    existingConfig?: Record<string, unknown>;
    existingId?: string;
  } | null>(null);

  // Fetch integrations
  const fetchIntegrations = useCallback(async () => {
    if (!id) return;
    setIntegrationsLoading(true);
    
    const { data, error } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", id);
    
    if (error) {
      console.error("Error fetching integrations:", error);
    } else {
      setIntegrations(data || []);
    }
    setIntegrationsLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Get integration by type
  const getIntegration = (type: IntegrationType): TenantIntegration | undefined => {
    return integrations.find((i) => i.integration_type === type);
  };

  // Handle opening integration modal
  const openIntegrationModal = (type: IntegrationType) => {
    const existing = getIntegration(type);
    setIntegrationModal({
      type,
      existingConfig: existing?.config,
      existingId: existing?.id,
    });
  };

  // Impersonation
  const { startImpersonation } = useImpersonation();

  const handleViewAsTenant = () => {
    if (tenant) {
      startImpersonation(tenant.id, tenant.name);
    }
  };

  const handleStatusChange = async () => {
    if (!tenant || !showStatusModal) return;
    const newStatus = showStatusModal === "activate" ? "ACTIVE" : "SUSPENDED";
    try {
      await updateTenantStatus(tenant.id, newStatus);
      toast.success(`Tenant ${newStatus === "ACTIVE" ? "activado" : "suspendido"} correctamente`);
      setShowStatusModal(null);
      refetch();
    } catch (error) {
      toast.error("Error al actualizar el tenant");
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (error || !tenant) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error">
          {error || "No se pudo cargar el tenant"}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={tenant.name}
        description={`/${tenant.slug}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Tenants", href: "/admin/tenants" },
          { label: tenant.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <TenantStatusBadge status={tenant.status} />
            <Button
              variant="secondary"
              leftIcon={<Edit className="h-4 w-4" />}
              onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
            >
              Editar
            </Button>
            <ActionDropdown
              items={[
                tenant.status !== "ACTIVE"
                  ? {
                      label: "Activar tenant",
                      onClick: () => setShowStatusModal("activate"),
                    }
                  : {
                      label: "Suspender tenant",
                      onClick: () => setShowStatusModal("suspend"),
                      danger: true,
                    },
                { divider: true, label: "" },
                {
                  label: "Ver como tenant",
                  onClick: handleViewAsTenant,
                },
              ]}
            />
          </div>
        }
      />

      {/* Stats */}
      <StatsGrid columns={4} className="mb-6">
        <StatCard
          title="Total Leads"
          value={tenant._count?.leads || 0}
          icon={<Users />}
          iconColor="from-blue-500 to-cyan-500"
          change={12}
          trend="up"
        />
        <StatCard
          title="Ofertas Activas"
          value={tenant._count?.offers || 0}
          icon={<Package />}
          iconColor="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Créditos"
          value={tenant.credit_balance || 0}
          icon={<CreditCard />}
          iconColor={tenant.credit_balance && tenant.credit_balance < 10 ? "from-amber-500 to-orange-500" : "from-purple-500 to-pink-500"}
          trend={tenant.credit_balance && tenant.credit_balance < 10 ? "down" : "neutral"}
        />
        <StatCard
          title="Miembros"
          value={tenant._count?.members || 0}
          icon={<Users />}
          iconColor="from-slate-500 to-slate-600"
        />
      </StatsGrid>

      {/* Low credits warning */}
      {tenant.credit_balance !== undefined && tenant.credit_balance < 10 && (
        <Alert variant="warning" className="mb-6" title="Créditos bajos">
          Este tenant tiene solo {tenant.credit_balance} créditos restantes. Considerar contactar para recargar.
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList>
          <TabTrigger value="general">General</TabTrigger>
          <TabTrigger value="pricing">Pricing</TabTrigger>
          <TabTrigger value="offers" count={tenant._count?.offers}>Ofertas</TabTrigger>
          <TabTrigger value="users" count={tenant._count?.members}>Usuarios</TabTrigger>
          <TabTrigger value="integrations">Integraciones</TabTrigger>
          <TabTrigger value="activity">Actividad</TabTrigger>
        </TabsList>

        {/* General Tab */}
        <TabContent value="general">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow
                  icon={<Mail className="h-5 w-5" />}
                  label="Email"
                  value={tenant.contact_email || "No configurado"}
                />
                <InfoRow
                  icon={<Phone className="h-5 w-5" />}
                  label="Teléfono"
                  value={tenant.contact_phone || "No configurado"}
                />
                <InfoRow
                  icon={<Globe className="h-5 w-5" />}
                  label="Zona horaria"
                  value={tenant.timezone}
                />
                <InfoRow
                  icon={<Calendar className="h-5 w-5" />}
                  label="Creado"
                  value={formatDate(tenant.created_at)}
                />
                {tenant.activated_at && (
                  <InfoRow
                    icon={<CheckCircle className="h-5 w-5" />}
                    label="Activado"
                    value={formatDate(tenant.activated_at)}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow
                  icon={<TrendingUp className="h-5 w-5" />}
                  label="Score threshold"
                  value={`${tenant.default_score_threshold}/100`}
                />
                <InfoRow
                  icon={<Clock className="h-5 w-5" />}
                  label="Ventana duplicados"
                  value={`${tenant.duplicate_window_days} días`}
                />
              </CardContent>
            </Card>
          </div>
        </TabContent>

        {/* Pricing Tab */}
        <TabContent value="pricing">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Modelo de cobro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow
                  label="Tipo"
                  value={
                    <Badge variant="primary">
                      {pricing?.charge_model === "PER_LEAD"
                        ? "Por Lead"
                        : pricing?.charge_model === "PER_SALE"
                        ? "Por Venta"
                        : "Suscripción"}
                    </Badge>
                  }
                />
                <InfoRow
                  label="Costo por lead"
                  value={formatCurrency(pricing?.cost_per_lead || 0)}
                />
                <InfoRow
                  label="Umbral bajo de créditos"
                  value={`${pricing?.low_credit_threshold || 10} créditos`}
                />
                <InfoRow
                  label="Auto-refund duplicados"
                  value={pricing?.auto_refund_duplicates ? "Sí" : "No"}
                />
                <InfoRow
                  label="Auto-refund spam"
                  value={pricing?.auto_refund_spam ? "Sí" : "No"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Paquetes disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                {pricing?.packages && pricing.packages.length > 0 ? (
                  <div className="space-y-3">
                    {(pricing.packages as Array<{ id: string; name: string; credits: number; price: number; discount_pct?: number; is_popular?: boolean }>).map((pkg) => (
                      <div
                        key={pkg.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-card-border/50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{pkg.name}</span>
                            {pkg.is_popular && (
                              <Badge variant="primary" size="sm">Popular</Badge>
                            )}
                          </div>
                          <span className="text-sm text-slate-500">{pkg.credits} créditos</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-white">
                            {formatCurrency(pkg.price)}
                          </span>
                          {pkg.discount_pct && (
                            <span className="block text-xs text-emerald-400">
                              {pkg.discount_pct}% descuento
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">
                    No hay paquetes configurados
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabContent>

        {/* Offers Tab */}
        <TabContent value="offers">
          <Card>
            <CardHeader action={
              <Button
                size="sm"
                onClick={() => router.push(`/admin/offers/new?tenant=${tenant.id}`)}
              >
                Nueva oferta
              </Button>
            }>
              <CardTitle>Ofertas del tenant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-center py-8">
                Ir a <Link href={`/admin/offers?tenant=${tenant.id}`} className="text-primary-400 hover:underline">Ofertas</Link> para ver todas las ofertas de este tenant.
              </p>
            </CardContent>
          </Card>
        </TabContent>

        {/* Users Tab */}
        <TabContent value="users">
          <Card>
            <CardHeader action={
              <Button size="sm">Invitar usuario</Button>
            }>
              <CardTitle>Miembros del equipo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-center py-8">
                Los usuarios del tenant se gestionan desde la sección de <Link href="/admin/users" className="text-primary-400 hover:underline">Usuarios</Link>.
              </p>
            </CardContent>
          </Card>
        </TabContent>

        {/* Integrations Tab */}
        <TabContent value="integrations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IntegrationCard
              title="Google Sheets"
              description="Envía leads calificados automáticamente a un spreadsheet"
              integration={getIntegration("GOOGLE_SHEETS")}
              isLoading={integrationsLoading}
              onConfigure={() => openIntegrationModal("GOOGLE_SHEETS")}
            />

            <IntegrationCard
              title="Tokko CRM"
              description="Sincroniza leads con tu cuenta de Tokko Broker"
              integration={getIntegration("TOKKO")}
              isLoading={integrationsLoading}
              onConfigure={() => openIntegrationModal("TOKKO")}
            />
          </div>
        </TabContent>

        {/* Activity Tab */}
        <TabContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Historial de actividad</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-center py-8">
                No hay actividad reciente registrada.
              </p>
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>

      {/* Status Change Modal */}
      <ConfirmModal
        isOpen={!!showStatusModal}
        onClose={() => setShowStatusModal(null)}
        onConfirm={handleStatusChange}
        title={showStatusModal === "activate" ? "Activar tenant" : "Suspender tenant"}
        description={
          showStatusModal === "activate"
            ? "El tenant podrá recibir leads y usar la plataforma normalmente."
            : "El tenant dejará de recibir leads y no podrá acceder a la plataforma."
        }
        confirmText={showStatusModal === "activate" ? "Activar" : "Suspender"}
        variant={showStatusModal === "suspend" ? "danger" : "default"}
        isLoading={isMutating}
      />

      {/* Integration Config Modal */}
      {integrationModal && tenant && (
        <IntegrationConfigModal
          isOpen={true}
          onClose={() => setIntegrationModal(null)}
          onSuccess={fetchIntegrations}
          type={integrationModal.type}
          tenantId={tenant.id}
          existingConfig={integrationModal.existingConfig as any}
          existingIntegrationId={integrationModal.existingId}
        />
      )}
    </PageContainer>
  );
}

// ============================================
// Helper Components
// ============================================

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3 text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-white">{value}</div>
    </div>
  );
}

function IntegrationCard({
  title,
  description,
  integration,
  isLoading,
  onConfigure,
}: {
  title: string;
  description: string;
  integration?: TenantIntegration;
  isLoading: boolean;
  onConfigure: () => void;
}) {
  const isConfigured = !!integration;
  const isActive = integration?.is_active;
  const hasError = integration?.status === "ERROR";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : isConfigured ? (
            hasError ? (
              <Badge variant="danger" dot>Error</Badge>
            ) : isActive ? (
              <Badge variant="success" dot>Activo</Badge>
            ) : (
              <Badge variant="secondary" dot>Inactivo</Badge>
            )
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-slate-400 text-sm mb-4">{description}</p>
        
        {isConfigured ? (
          <div className="space-y-3">
            {integration.last_sync_at && (
              <p className="text-xs text-slate-500">
                Última sync: {formatDate(integration.last_sync_at)}
              </p>
            )}
            {integration.last_error && (
              <Alert variant="error" className="text-xs">
                {integration.last_error}
              </Alert>
            )}
            <Button variant="secondary" fullWidth onClick={onConfigure}>
              Editar configuración
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-slate-500 mb-4">No configurado</p>
            <Button variant="secondary" fullWidth onClick={onConfigure}>
              Configurar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

