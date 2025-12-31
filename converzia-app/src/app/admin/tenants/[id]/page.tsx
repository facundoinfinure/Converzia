"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  MapPin,
  Plus,
  UserPlus,
  Activity,
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
import { DataTable, Column } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useTenant, useTenantMutations } from "@/lib/hooks/use-tenants";
import { formatDate, formatCurrency, formatRelativeTime } from "@/lib/utils";
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

interface TenantOffer {
  id: string;
  name: string;
  slug: string;
  status: string;
  approval_status: string;
  city?: string;
  zone?: string;
  price_from?: number;
  price_to?: number;
  currency?: string;
  created_at: string;
  _count?: { leads: number; ads: number };
}

interface TenantMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  user_profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface ActivityEvent {
  id: string;
  type: "tenant_created" | "tenant_activated" | "offer_created" | "member_joined" | "lead_received";
  description: string;
  timestamp: string;
  icon: React.ReactNode;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function TenantDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const supabase = createClient();

  // Handle OAuth callback success message
  useEffect(() => {
    const googleConnected = searchParams.get("google_connected");
    const error = searchParams.get("error");

    if (googleConnected === "true") {
      toast.success("Cuenta de Google conectada correctamente");
      // Clean up URL
      router.replace(`/admin/tenants/${id}`, { scroll: false });
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
      router.replace(`/admin/tenants/${id}`, { scroll: false });
    }
  }, [searchParams, router, id, toast]);
  const { tenant, pricing, isLoading, error, refetch } = useTenant(id);
  const { updateTenantStatus, isLoading: isMutating } = useTenantMutations();
  const [showStatusModal, setShowStatusModal] = useState<"activate" | "suspend" | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [isInviting, setIsInviting] = useState(false);

  // Integration state
  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [integrationModal, setIntegrationModal] = useState<{
    type: IntegrationType;
    existingConfig?: Record<string, unknown>;
    existingId?: string;
  } | null>(null);

  // Offers state
  const [offers, setOffers] = useState<TenantOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);

  // Members state
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // Activity state
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

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

  // Fetch offers
  const fetchOffers = useCallback(async () => {
    if (!id) return;
    setOffersLoading(true);

    try {
      const { data, error } = await supabase
        .from("offers")
        .select("id, name, slug, status, approval_status, city, zone, price_from, price_to, currency, created_at")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get counts for each offer
      const offersWithCounts = await Promise.all(
        (data || []).map(async (offer: any) => {
          const [{ count: leadsCount }, { count: adsCount }] = await Promise.all([
            supabase.from("lead_offers").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
            supabase.from("ad_offer_map").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
          ]);
          return { ...offer, _count: { leads: leadsCount || 0, ads: adsCount || 0 } };
        })
      );

      setOffers(offersWithCounts);
    } catch (err) {
      console.error("Error fetching offers:", err);
    } finally {
      setOffersLoading(false);
    }
  }, [id, supabase]);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!id) return;
    setMembersLoading(true);

    try {
      const { data, error } = await supabase
        .from("tenant_members")
        .select("id, user_id, role, status, created_at, user_profiles(id, full_name, email, avatar_url)")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Flatten user_profiles from array to single object
      const formattedData = (data || []).map((m: any) => ({
        ...m,
        user_profiles: Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles,
      }));
      
      setMembers(formattedData);
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setMembersLoading(false);
    }
  }, [id, supabase]);

  // Fetch activity
  const fetchActivity = useCallback(async () => {
    if (!id || !tenant) return;
    setActivityLoading(true);

    try {
      const events: ActivityEvent[] = [];

      // Tenant created
      if (tenant.created_at) {
        events.push({
          id: "tenant_created",
          type: "tenant_created",
          description: "Tenant registrado",
          timestamp: tenant.created_at,
          icon: <Building2 className="h-4 w-4" />,
        });
      }

      // Tenant activated
      if (tenant.activated_at) {
        events.push({
          id: "tenant_activated",
          type: "tenant_activated",
          description: "Tenant activado",
          timestamp: tenant.activated_at,
          icon: <CheckCircle className="h-4 w-4 text-emerald-400" />,
        });
      }

      // Get recent offers
      const { data: recentOffers } = await supabase
        .from("offers")
        .select("id, name, created_at")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false })
        .limit(5);

      (recentOffers || []).forEach((offer: any) => {
        events.push({
          id: `offer_${offer.id}`,
          type: "offer_created",
          description: `Oferta "${offer.name}" creada`,
          timestamp: offer.created_at,
          icon: <Package className="h-4 w-4 text-emerald-400" />,
        });
      });

      // Get recent members
      const { data: recentMembers } = await supabase
        .from("tenant_members")
        .select("id, created_at, user_profiles(full_name)")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false })
        .limit(5);

      (recentMembers || []).forEach((member: any) => {
        const userName = Array.isArray(member.user_profiles) 
          ? member.user_profiles[0]?.full_name 
          : member.user_profiles?.full_name;
        events.push({
          id: `member_${member.id}`,
          type: "member_joined",
          description: `${userName || "Usuario"} se unió al equipo`,
          timestamp: member.created_at,
          icon: <UserPlus className="h-4 w-4 text-blue-400" />,
        });
      });

      // Sort by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivity(events.slice(0, 10));
    } catch (err) {
      console.error("Error fetching activity:", err);
    } finally {
      setActivityLoading(false);
    }
  }, [id, tenant, supabase]);

  useEffect(() => {
    fetchOffers();
    fetchMembers();
  }, [fetchOffers, fetchMembers]);

  useEffect(() => {
    if (tenant) {
      fetchActivity();
    }
  }, [tenant, fetchActivity]);

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

  const handleInvite = async () => {
    if (!inviteEmail || !tenant) return;

    setIsInviting(true);

    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", inviteEmail)
        .single();

      if (existingUser) {
        // User exists, create membership
        const { error } = await supabase.from("tenant_members").insert({
          tenant_id: tenant.id,
          user_id: existingUser.id,
          role: inviteRole,
          status: "PENDING_APPROVAL",
        });

        if (error) throw error;
        toast.success("Invitación enviada. El usuario debe ser aprobado por un admin de Converzia.");
      } else {
        // User doesn't exist, would need to invite via email
        toast.info("El usuario no existe. Cuando se registre podrá solicitar acceso.");
      }

      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("VIEWER");
      refetch();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast.error(error.message || "Error al enviar invitación");
    } finally {
      setIsInviting(false);
    }
  };

  // Offers table columns
  const offersColumns: Column<TenantOffer>[] = [
    {
      key: "name",
      header: "Oferta",
      cell: (offer) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-[var(--text-primary)]" />
          </div>
          <div className="min-w-0">
            <span className="font-medium text-[var(--text-primary)] block truncate">
              {offer.name}
            </span>
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{offer.city || offer.zone || "Sin ubicación"}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (offer) => {
        const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "default" }> = {
          ACTIVE: { label: "Activo", variant: "success" },
          DRAFT: { label: "Borrador", variant: "secondary" },
          PAUSED: { label: "Pausado", variant: "warning" },
          ARCHIVED: { label: "Archivado", variant: "default" },
        };
        const config = statusConfig[offer.status] || { label: offer.status, variant: "default" };
        return <StatusBadge status={config.label} variant={config.variant} />;
      },
    },
    {
      key: "price",
      header: "Precio",
      cell: (offer) => (
        <span className="text-[var(--text-secondary)]">
          {offer.price_from
            ? offer.price_to && offer.price_to !== offer.price_from
              ? `${formatCurrency(offer.price_from, offer.currency)} - ${formatCurrency(offer.price_to, offer.currency)}`
              : formatCurrency(offer.price_from, offer.currency)
            : "Sin precio"}
        </span>
      ),
    },
    {
      key: "stats",
      header: "Stats",
      cell: (offer) => (
        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
          <span title="Leads">{offer._count?.leads || 0} leads</span>
          <span title="Ads">{offer._count?.ads || 0} ads</span>
        </div>
      ),
    },
  ];

  // Members table columns
  const membersColumns: Column<TenantMember>[] = [
    {
      key: "user",
      header: "Usuario",
      cell: (member) => (
        <div className="flex items-center gap-3">
          <Avatar
            src={member.user_profiles?.avatar_url}
            alt={member.user_profiles?.full_name || "Usuario"}
            size="sm"
          />
          <div className="min-w-0">
            <span className="font-medium text-[var(--text-primary)] block truncate">
              {member.user_profiles?.full_name || "Usuario sin nombre"}
            </span>
            <span className="text-xs text-[var(--text-tertiary)] truncate block">
              {member.user_profiles?.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol",
      cell: (member) => {
        const roleLabels: Record<string, string> = {
          OWNER: "Owner",
          ADMIN: "Admin",
          BILLING: "Billing",
          VIEWER: "Viewer",
        };
        return (
          <Badge variant="secondary">
            {roleLabels[member.role] || member.role}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      cell: (member) => {
        const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "danger" }> = {
          ACTIVE: { label: "Activo", variant: "success" },
          PENDING_APPROVAL: { label: "Pendiente", variant: "warning" },
          SUSPENDED: { label: "Suspendido", variant: "danger" },
          REVOKED: { label: "Revocado", variant: "secondary" },
        };
        const config = statusConfig[member.status] || { label: member.status, variant: "secondary" };
        return <StatusBadge status={config.label} variant={config.variant} />;
      },
    },
    {
      key: "joined",
      header: "Agregado",
      cell: (member) => (
        <span className="text-[var(--text-tertiary)] text-sm">
          {formatRelativeTime(member.created_at)}
        </span>
      ),
    },
  ];

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
                            <span className="font-medium text-[var(--text-primary)]">{pkg.name}</span>
                            {pkg.is_popular && (
                              <Badge variant="primary" size="sm">Popular</Badge>
                            )}
                          </div>
                          <span className="text-sm text-[var(--text-tertiary)]">{pkg.credits} créditos</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-[var(--text-primary)]">
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
                  <p className="text-[var(--text-tertiary)] text-center py-4">
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
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Nueva oferta
              </Button>
            }>
              <CardTitle>Ofertas del tenant</CardTitle>
            </CardHeader>
            <DataTable
              data={offers}
              columns={offersColumns}
              keyExtractor={(o) => o.id}
              isLoading={offersLoading}
              loadingRows={3}
              onRowClick={(offer) => router.push(`/admin/offers/${offer.id}`)}
              emptyState={
                <EmptyState
                  icon={<Package />}
                  title="Sin ofertas"
                  description="Este tenant no tiene ofertas creadas aún."
                  action={{
                    label: "Crear oferta",
                    onClick: () => router.push(`/admin/offers/new?tenant=${tenant.id}`),
                  }}
                  size="sm"
                />
              }
            />
            {offers.length > 0 && (
              <div className="p-4 border-t border-[var(--border-primary)]">
                <Link
                  href={`/admin/offers?tenant=${tenant.id}`}
                  className="text-sm text-[var(--accent-primary)] hover:underline"
                >
                  Ver todas las ofertas →
                </Link>
              </div>
            )}
          </Card>
        </TabContent>

        {/* Users Tab */}
        <TabContent value="users">
          <Card>
            <CardHeader action={
              <Button size="sm" onClick={() => setShowInviteModal(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
                Invitar usuario
              </Button>
            }>
              <CardTitle>Miembros del equipo</CardTitle>
            </CardHeader>
            <DataTable
              data={members}
              columns={membersColumns}
              keyExtractor={(m) => m.id}
              isLoading={membersLoading}
              loadingRows={3}
              emptyState={
                <EmptyState
                  icon={<Users />}
                  title="Sin miembros"
                  description="Este tenant no tiene miembros asignados."
                  action={{
                    label: "Invitar usuario",
                    onClick: () => setShowInviteModal(true),
                  }}
                  size="sm"
                />
              }
            />
            {members.length > 0 && (
              <div className="p-4 border-t border-[var(--border-primary)]">
                <Link
                  href={`/admin/users?tenant=${tenant.id}`}
                  className="text-sm text-[var(--accent-primary)] hover:underline"
                >
                  Gestionar usuarios →
                </Link>
              </div>
            )}
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
              {activityLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : activity.length === 0 ? (
                <EmptyState
                  icon={<Activity />}
                  title="Sin actividad"
                  description="No hay actividad registrada para este tenant."
                  size="sm"
                />
              ) : (
                <div className="space-y-1">
                  {activity.map((event, index) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 py-3 px-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                        {event.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)]">{event.description}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {formatRelativeTime(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Invite User Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteEmail("");
          setInviteRole("VIEWER");
        }}
        title="Invitar usuario"
        description="Ingresá el email del usuario que querés invitar"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleInvite}
              isLoading={isInviting}
              disabled={!inviteEmail}
            >
              Enviar invitación
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="usuario@empresa.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            leftIcon={<Mail className="h-4 w-4" />}
            required
          />
          <Select
            label="Rol"
            options={[
              { value: "VIEWER", label: "Viewer" },
              { value: "BILLING", label: "Billing" },
              { value: "ADMIN", label: "Admin" },
              { value: "OWNER", label: "Owner" },
            ]}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          />
        </div>
      </Modal>
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
      <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-[var(--text-primary)]">{value}</div>
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
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
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
        <p className="text-[var(--text-tertiary)] text-sm mb-4">{description}</p>
        
        {isConfigured ? (
          <div className="space-y-3">
            {integration.last_sync_at && (
              <p className="text-xs text-[var(--text-tertiary)]">
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









