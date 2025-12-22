"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Phone,
  Mail,
  ChevronRight,
  Pause,
  Play,
  FileText,
  Upload,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, Column } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useAuth } from "@/lib/auth/context";
import { formatRelativeTime, formatCurrency } from "@/lib/utils";

interface FunnelStats {
  offer_id: string;
  offer_name: string;
  offer_status: string;
  approval_status: string;
  total_leads: number;
  leads_pending_contact: number;
  leads_in_chat: number;
  leads_qualified: number;
  leads_delivered: number;
  leads_disqualified: number;
  leads_stopped: number;
  conversion_rate: number;
  // Disqualification breakdown
  dq_price_high: number;
  dq_price_low: number;
  dq_wrong_zone: number;
  dq_wrong_typology: number;
  dq_no_response: number;
  dq_not_interested: number;
  dq_missing_amenity: number;
  dq_other: number;
}

interface Lead {
  id: string;
  lead_display_name: string;
  lead_phone: string | null;
  lead_email: string | null;
  status: string;
  score_total: number;
  qualification_fields: any;
  created_at: string;
  qualified_at: string | null;
  delivery_status: string | null;
  delivered_at: string | null;
}

interface Offer {
  id: string;
  name: string;
  status: string;
  approval_status: string;
  city: string | null;
  zone: string | null;
  price_from: number | null;
  price_to: number | null;
  currency: string;
  image_url: string | null;
  short_description: string | null;
  rejection_reason: string | null;
}

export default function PortalOfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { activeTenantId, hasPermission } = useAuth();
  
  const offerId = params.id as string;
  
  const [offer, setOffer] = useState<Offer | null>(null);
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [deliveredLeads, setDeliveredLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPausing, setIsPausing] = useState(false);

  const canManageOffers = hasPermission?.('manage_offers') ?? false;

  useEffect(() => {
    loadOfferData();
  }, [offerId, activeTenantId]);

  async function loadOfferData() {
    if (!offerId || !activeTenantId) return;
    
    setIsLoading(true);
    const supabase = createClient();

    try {
      // Load offer details
      const { data: offerData, error: offerError } = await queryWithTimeout(
        supabase
          .from("offers")
          .select("*")
          .eq("id", offerId)
          .eq("tenant_id", activeTenantId)
          .single(),
        10000,
        "load offer"
      );

      if (offerError || !offerData) {
        toast.error("Proyecto no encontrado");
        router.push("/portal/offers");
        return;
      }

      setOffer(offerData);

      // Load funnel stats
      const { data: funnelData } = await queryWithTimeout(
        supabase
          .from("offer_funnel_stats")
          .select("*")
          .eq("offer_id", offerId)
          .single(),
        10000,
        "load funnel"
      );

      setFunnel(funnelData);

      // Load delivered leads (with full contact info)
      const { data: leadsData } = await queryWithTimeout(
        supabase
          .from("tenant_leads_anonymized")
          .select("*")
          .eq("offer_id", offerId)
          .eq("tenant_id", activeTenantId)
          .eq("status", "SENT_TO_DEVELOPER")
          .order("qualified_at", { ascending: false })
          .limit(50),
        10000,
        "load delivered leads"
      );

      setDeliveredLeads(leadsData || []);
    } catch (error) {
      console.error("Error loading offer:", error);
      toast.error("Error al cargar el proyecto");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePauseResume() {
    if (!offer || !canManageOffers) return;
    
    setIsPausing(true);
    const supabase = createClient();
    const newStatus = offer.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';

    try {
      const { error } = await supabase
        .from("offers")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", offerId);

      if (error) throw error;

      setOffer({ ...offer, status: newStatus });
      toast.success(newStatus === 'PAUSED' ? 'Proyecto pausado' : 'Proyecto activado');
    } catch (error) {
      toast.error("Error al cambiar estado");
    } finally {
      setIsPausing(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (!offer) {
    return null;
  }

  // Funnel stage data for visualization
  const funnelStages = funnel ? [
    { label: "Recibidos", value: funnel.total_leads, color: "bg-slate-500" },
    { label: "En chat", value: funnel.leads_in_chat, color: "bg-blue-500" },
    { label: "Calificados", value: funnel.leads_qualified, color: "bg-purple-500" },
    { label: "Entregados", value: funnel.leads_delivered, color: "bg-emerald-500" },
  ] : [];

  // Disqualification insights
  const disqualificationInsights = funnel ? [
    { label: "Precio alto", value: funnel.dq_price_high, color: "bg-red-500" },
    { label: "Precio bajo", value: funnel.dq_price_low, color: "bg-red-400" },
    { label: "Zona incorrecta", value: funnel.dq_wrong_zone, color: "bg-orange-500" },
    { label: "Tipología", value: funnel.dq_wrong_typology, color: "bg-orange-400" },
    { label: "Sin respuesta", value: funnel.dq_no_response, color: "bg-yellow-500" },
    { label: "No interesado", value: funnel.dq_not_interested, color: "bg-gray-500" },
    { label: "Amenity faltante", value: funnel.dq_missing_amenity, color: "bg-pink-500" },
    { label: "Otros", value: funnel.dq_other, color: "bg-gray-400" },
  ].filter(i => i.value > 0).sort((a, b) => b.value - a.value) : [];

  const totalDisqualified = disqualificationInsights.reduce((sum, i) => sum + i.value, 0);

  // Lead columns for delivered leads table
  const leadColumns: Column<Lead>[] = [
    {
      key: "lead",
      header: "Lead",
      cell: (lead) => (
        <div>
          <p className="font-medium text-white">{lead.lead_display_name}</p>
          <p className="text-xs text-slate-500">Score: {lead.score_total}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      cell: (lead) => (
        <div className="space-y-1">
          {lead.lead_phone && (
            <a href={`tel:${lead.lead_phone}`} className="flex items-center gap-1 text-sm text-primary-400 hover:underline">
              <Phone className="h-3 w-3" />
              {lead.lead_phone}
            </a>
          )}
          {lead.lead_email && (
            <a href={`mailto:${lead.lead_email}`} className="flex items-center gap-1 text-sm text-slate-400 hover:underline">
              <Mail className="h-3 w-3" />
              {lead.lead_email}
            </a>
          )}
        </div>
      ),
    },
    {
      key: "qualification",
      header: "Búsqueda",
      cell: (lead) => {
        const q = lead.qualification_fields || {};
        return (
          <div className="text-sm text-slate-400">
            {q.bedrooms && <span>{q.bedrooms} amb</span>}
            {q.zone && <span> • {Array.isArray(q.zone) ? q.zone[0] : q.zone}</span>}
            {q.budget?.max && <span> • hasta {formatCurrency(q.budget.max, 'USD')}</span>}
          </div>
        );
      },
    },
    {
      key: "delivered",
      header: "Entregado",
      cell: (lead) => (
        <span className="text-sm text-slate-400">
          {lead.delivered_at ? formatRelativeTime(lead.delivered_at) : formatRelativeTime(lead.qualified_at || lead.created_at)}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/portal/offers")}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Volver
        </Button>
      </div>

      <PageHeader
        title={offer.name}
        description={offer.city ? `${offer.city}${offer.zone ? `, ${offer.zone}` : ''}` : undefined}
        actions={
          canManageOffers && offer.approval_status === 'APPROVED' && (
            <Button
              variant="secondary"
              onClick={handlePauseResume}
              isLoading={isPausing}
              leftIcon={offer.status === 'PAUSED' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            >
              {offer.status === 'PAUSED' ? 'Reanudar' : 'Pausar'}
            </Button>
          )
        }
      />

      {/* Status alerts */}
      {offer.approval_status === 'PENDING_APPROVAL' && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-3">
          <Clock className="h-5 w-5 text-blue-400" />
          <div>
            <p className="font-medium text-blue-400">En revisión por Converzia</p>
            <p className="text-sm text-slate-400">Te notificaremos cuando tu proyecto esté aprobado.</p>
          </div>
        </div>
      )}

      {offer.approval_status === 'REJECTED' && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="h-5 w-5 text-red-400" />
            <p className="font-medium text-red-400">Proyecto rechazado</p>
          </div>
          {offer.rejection_reason && (
            <p className="text-sm text-slate-400 ml-8">{offer.rejection_reason}</p>
          )}
          {canManageOffers && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 ml-8"
              onClick={() => router.push(`/portal/offers/${offerId}/edit`)}
            >
              Editar y reenviar
            </Button>
          )}
        </div>
      )}

      {/* Funnel Stats */}
      {funnel && funnel.total_leads > 0 && (
        <>
          {/* Funnel Visualization */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Funnel de leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-4 h-48">
                {funnelStages.map((stage, idx) => {
                  const maxValue = Math.max(...funnelStages.map(s => s.value));
                  const height = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
                  const percentage = funnel.total_leads > 0 
                    ? Math.round((stage.value / funnel.total_leads) * 100) 
                    : 0;

                  return (
                    <div key={stage.label} className="flex-1 flex flex-col items-center">
                      <span className="text-2xl font-bold text-white mb-1">{stage.value}</span>
                      <span className="text-xs text-slate-500 mb-2">{percentage}%</span>
                      <div 
                        className={`w-full rounded-t-lg ${stage.color} transition-all duration-500`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                      <span className="text-sm text-slate-400 mt-2 text-center">{stage.label}</span>
                      {idx < funnelStages.length - 1 && (
                        <ChevronRight className="absolute h-4 w-4 text-slate-600" style={{ right: '-0.75rem' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Conversion rate */}
              <div className="mt-6 pt-4 border-t border-card-border flex items-center justify-between">
                <span className="text-slate-400">Tasa de conversión</span>
                <span className="text-2xl font-bold text-emerald-400">{funnel.conversion_rate}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Disqualification Insights */}
          {totalDisqualified > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Motivos de descalificación</CardTitle>
                  <Badge variant="secondary">{totalDisqualified} leads</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {disqualificationInsights.slice(0, 5).map((insight) => {
                    const percentage = totalDisqualified > 0 
                      ? Math.round((insight.value / totalDisqualified) * 100) 
                      : 0;

                    return (
                      <div key={insight.label} className="flex items-center gap-4">
                        <div className="w-32 text-sm text-slate-400">{insight.label}</div>
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${insight.color} rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm font-medium text-white">{insight.value}</span>
                          <span className="text-xs text-slate-500 ml-1">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty state for no leads */}
      {(!funnel || funnel.total_leads === 0) && (
        <Card className="mb-6">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Sin leads todavía</h3>
            <p className="text-slate-400">
              {offer.approval_status === 'APPROVED' 
                ? "Los leads aparecerán aquí cuando tu campaña empiece a generar resultados."
                : "Los leads llegarán una vez que tu proyecto sea aprobado y la campaña esté activa."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delivered Leads Table */}
      {deliveredLeads.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Leads entregados</CardTitle>
              <Badge variant="success">{deliveredLeads.length} leads</Badge>
            </div>
          </CardHeader>
          <DataTable
            data={deliveredLeads}
            columns={leadColumns}
            keyExtractor={(lead) => lead.id}
          />
        </Card>
      )}
    </PageContainer>
  );
}

