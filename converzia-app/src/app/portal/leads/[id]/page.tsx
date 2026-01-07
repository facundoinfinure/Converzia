"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  MessageSquare,
  Calendar,
  ExternalLink,
  Info,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatRelativeTime } from "@/lib/utils";
import { TENANT_FUNNEL_STAGES } from "@/lib/constants/tenant-funnel";

interface LeadDetails {
  id: string;
  status: string;
  score_total: number | null;
  qualification_fields: any;
  created_at: string;
  updated_at: string;
  lead: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    first_contact_at: string | null;
    last_contact_at: string | null;
  } | null;
  offer: {
    id: string;
    name: string;
  } | null;
  delivery: {
    id: string;
    status: string;
    delivered_at: string | null;
  } | null;
}

export default function PortalLeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { activeTenantId } = useAuth();
  const leadOfferId = params.id as string;
  
  const [leadDetails, setLeadDetails] = useState<LeadDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = createClient();

  const loadLeadDetails = useCallback(async () => {
    if (!leadOfferId || !activeTenantId) return;
    
    setIsLoading(true);
    
    try {
      // Optimized query: filter by id first (primary key), then tenant_id for security
      // Joins are optimized by selecting only needed fields
      const { data: leadOfferData, error: leadOfferError } = await queryWithTimeout(
        supabase
          .from("lead_offers")
          .select(`
            id,
            status,
            score_total,
            qualification_fields,
            created_at,
            updated_at,
            lead:leads(
              id,
              full_name,
              phone,
              email,
              first_contact_at,
              last_contact_at
            ),
            offer:offers!lead_offers_offer_id_fkey(
              id,
              name
            ),
            delivery:deliveries(
              id,
              status,
              delivered_at
            )
          `)
          .eq("id", leadOfferId)
          .eq("tenant_id", activeTenantId)
          .single(),
        15000, // Increased timeout for multiple joins, but should be faster with indexes
        "load lead details"
      );

      if (leadOfferError) {
        console.error("Error loading lead:", leadOfferError);
        toast.error("Error al cargar el lead");
        router.push("/portal/leads");
        return;
      }

      if (!leadOfferData) {
        toast.error("Lead no encontrado");
        router.push("/portal/leads");
        return;
      }

      // Transform the data to match our interface
      const data = leadOfferData as any;
      const lead = Array.isArray(data.lead) ? data.lead[0] : data.lead;
      const offer = Array.isArray(data.offer) ? data.offer[0] : data.offer;
      const delivery = Array.isArray(data.delivery) ? data.delivery[0] : data.delivery;

      setLeadDetails({
        id: data.id,
        status: data.status,
        score_total: data.score_total,
        qualification_fields: data.qualification_fields,
        created_at: data.created_at,
        updated_at: data.updated_at,
        lead: lead || null,
        offer: offer || null,
        delivery: delivery || null,
      });
    } catch (error) {
      console.error("Error loading lead details:", error);
      toast.error("Error al cargar detalles del lead");
      router.push("/portal/leads");
    } finally {
      setIsLoading(false);
    }
  }, [leadOfferId, activeTenantId, supabase, toast, router]);

  useEffect(() => {
    loadLeadDetails();
  }, [loadLeadDetails]);

  // Get status info
  const getStatusInfo = (status: string) => {
    const stage = TENANT_FUNNEL_STAGES.find(s => s.statuses.includes(status));
    
    if (!stage) {
      return { label: status, color: "gray", icon: Clock };
    }

    const statusConfig: Record<string, { color: string; icon: any }> = {
      received: { color: "blue", icon: Clock },
      in_chat: { color: "blue", icon: MessageSquare },
      qualified: { color: "green", icon: TrendingUp },
      delivered: { color: "green", icon: CheckCircle },
      not_qualified: { color: "red", icon: XCircle },
    };

    const config = statusConfig[stage.key] || { color: "gray", icon: Clock };
    
    return {
      label: stage.label,
      color: config.color,
      icon: config.icon,
    };
  };

  const statusInfo = leadDetails ? getStatusInfo(leadDetails.status) : null;
  const StatusIcon = statusInfo?.icon || Clock;

  // Check if lead data should be visible (delivered leads show full info)
  const isDelivered = leadDetails?.status === "SENT_TO_DEVELOPER" || leadDetails?.delivery?.status === "DELIVERED";
  const showLeadInfo = isDelivered && leadDetails?.lead;

  // No bloqueo completo - siempre mostrar estructura

  if (!leadDetails) {
    return (
      <PageContainer>
        <EmptyState
          icon={<User />}
          title="Lead no encontrado"
          description="El lead que buscás no existe o no tenés acceso a él."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Detalle del Lead"
        description={`Lead #${leadDetails.id.substring(0, 8)}`}
        breadcrumbs={[
          { label: "Portal", href: "/portal" },
          { label: "Mis Leads", href: "/portal/leads" },
          { label: "Detalle" },
        ]}
        actions={
          <Button
            variant="secondary"
            onClick={() => router.push("/portal/leads")}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Volver
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Status and Basic Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Información del Lead</CardTitle>
              {isLoading ? (
                <Skeleton className="h-6 w-24 rounded-full" />
              ) : (
                <Badge
                  variant={statusInfo?.color === "green" ? "success" : statusInfo?.color === "red" ? "danger" : "secondary"}
                  dot
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo?.label}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leadDetails.offer && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Proyecto
                  </label>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[var(--text-tertiary)]" />
                    <Link
                      href={`/portal/offers/${leadDetails.offer.id}`}
                      className="text-[var(--text-primary)] hover:text-[var(--accent-primary)] font-medium"
                    >
                      {leadDetails.offer.name}
                    </Link>
                  </div>
                </div>
              )}

              {leadDetails.score_total !== null && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Puntuación
                  </label>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[var(--text-tertiary)]" />
                    <span className="text-[var(--text-primary)] font-semibold">
                      {leadDetails.score_total}/100
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Fecha de creación
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <span className="text-[var(--text-primary)]">
                    {formatRelativeTime(leadDetails.created_at)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Última actualización
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <span className="text-[var(--text-primary)]">
                    {formatRelativeTime(leadDetails.updated_at)}
                  </span>
                </div>
              </div>
            </div>
              )}
          </CardContent>
        </Card>

        {/* Lead Contact Information - Only if delivered */}
        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : showLeadInfo && leadDetails.lead ? (
          <Card>
            <CardHeader>
              <CardTitle>Información de contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leadDetails.lead.full_name && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Nombre completo
                    </label>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <span className="text-[var(--text-primary)]">{leadDetails.lead.full_name}</span>
                    </div>
                  </div>
                )}

                {leadDetails.lead.phone && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Teléfono
                    </label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <a
                        href={`tel:${leadDetails.lead.phone}`}
                        className="text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                      >
                        {leadDetails.lead.phone}
                      </a>
                    </div>
                  </div>
                )}

                {leadDetails.lead.email && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Email
                    </label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <a
                        href={`mailto:${leadDetails.lead.email}`}
                        className="text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                      >
                        {leadDetails.lead.email}
                      </a>
                    </div>
                  </div>
                )}

                {leadDetails.lead.first_contact_at && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Primer contacto
                    </label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <span className="text-[var(--text-primary)]">
                        {formatRelativeTime(leadDetails.lead.first_contact_at)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Qualification Fields */}
        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : leadDetails.qualification_fields && typeof leadDetails.qualification_fields === 'object' ? (
          <Card>
            <CardHeader>
              <CardTitle>Información de calificación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(leadDetails.qualification_fields).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <p className="text-[var(--text-primary)]">
                      {typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Delivery Status */}
        {!isLoading && leadDetails.delivery && (
          <Card>
            <CardHeader>
              <CardTitle>Estado de entrega</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      leadDetails.delivery.status === "DELIVERED" 
                        ? "success" 
                        : leadDetails.delivery.status === "FAILED"
                        ? "danger"
                        : "secondary"
                    }
                  >
                    {leadDetails.delivery.status === "DELIVERED" ? "Entregado" :
                     leadDetails.delivery.status === "FAILED" ? "Fallido" :
                     leadDetails.delivery.status === "PENDING" ? "Pendiente" :
                     leadDetails.delivery.status}
                  </Badge>
                  {leadDetails.delivery.delivered_at && (
                    <span className="text-sm text-[var(--text-tertiary)]">
                      Entregado el {new Date(leadDetails.delivery.delivered_at).toLocaleString("es-AR")}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Privacy Notice for non-delivered leads */}
        {!isLoading && !isDelivered && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                <Info className="h-5 w-5 text-[var(--info)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    Información protegida
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    La información completa de contacto solo se mostrará cuando el lead sea entregado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
