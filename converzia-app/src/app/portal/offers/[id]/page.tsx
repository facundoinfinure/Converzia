"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  Edit,
  Settings,
  Link as LinkIcon,
  Plus,
  Trash2,
  Send,
  Info,
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
import { TENANT_FUNNEL_STAGES, standardizeFunnelStats, type StandardizedFunnelData } from "@/lib/constants/tenant-funnel";
import { IntegrationConfigModal } from "@/components/admin/IntegrationConfigModal";
import type { TenantIntegration } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";

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

interface RagSource {
  id: string;
  tenant_id: string;
  offer_id: string | null;
  source_type: "PDF" | "URL" | "MANUAL";
  name: string;
  description: string | null;
  source_url: string | null;
  storage_path: string | null;
  approval_status: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [integrationModalType, setIntegrationModalType] = useState<"GOOGLE_SHEETS" | "TOKKO">("GOOGLE_SHEETS");
  const [editingIntegration, setEditingIntegration] = useState<TenantIntegration | null>(null);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<RagSource | null>(null);
  const [documentForm, setDocumentForm] = useState({
    source_type: "PDF" as "PDF" | "URL" | "MANUAL",
    name: "",
    description: "",
    url: "",
    content: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const canManageOffers = hasPermission?.('offers:manage') ?? false;

  const loadOfferData = useCallback(async () => {
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

      setOffer(offerData as Offer);

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

      setFunnel(funnelData as FunnelStats | null);

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

      setDeliveredLeads((Array.isArray(leadsData) ? leadsData : []) as Lead[]);

      // Load integrations
      const { data: integrationsData } = await queryWithTimeout(
        supabase
          .from("tenant_integrations")
          .select("*")
          .eq("tenant_id", activeTenantId)
          .in("integration_type", ["GOOGLE_SHEETS", "TOKKO"])
          .order("created_at", { ascending: false }),
        10000,
        "load integrations"
      );

      setIntegrations((Array.isArray(integrationsData) ? integrationsData : []) as TenantIntegration[]);

      // Load RAG sources for this offer
      const { data: ragSourcesData } = await queryWithTimeout(
        supabase
          .from("rag_sources")
          .select("*")
          .eq("tenant_id", activeTenantId)
          .eq("offer_id", offerId)
          .order("created_at", { ascending: false }),
        10000,
        "load RAG sources"
      );

      setRagSources((Array.isArray(ragSourcesData) ? ragSourcesData : []) as RagSource[]);
    } catch (error) {
      console.error("Error loading offer:", error);
      toast.error("Error al cargar el proyecto");
    } finally {
      setIsLoading(false);
    }
  }, [offerId, activeTenantId, toast, router]);

  useEffect(() => {
    loadOfferData();
  }, [loadOfferData]);

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

  async function handleSubmitDocument() {
    if (!activeTenantId || !offerId || !canManageOffers) return;

    setIsUploadingDocument(true);
    const supabase = createClient();

    try {
      if (documentForm.source_type === "PDF") {
        if (!pdfFile) {
          toast.error("Seleccioná un archivo PDF");
          setIsUploadingDocument(false);
          return;
        }

        // Initialize storage
        const initResponse = await fetch("/api/storage/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            offer_id: offerId,
          }),
        });

        if (!initResponse.ok) {
          const initError = await initResponse.json();
          throw new Error(`Error al inicializar storage: ${initError.error}`);
        }

        // Create RAG source
        const { data: source, error: sourceError } = await supabase
          .from("rag_sources")
          .insert({
            tenant_id: activeTenantId,
            offer_id: offerId,
            source_type: "PDF",
            name: documentForm.name || pdfFile.name.replace(".pdf", ""),
            description: documentForm.description || null,
            is_active: false,
            approval_status: 'DRAFT',
          })
          .select()
          .single();

        if (sourceError) throw sourceError;

        // Upload PDF
        const storagePath = `${activeTenantId}/${offerId}/${source.id}/${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("rag-documents")
          .upload(storagePath, pdfFile, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          await supabase.from("rag_sources").delete().eq("id", source.id);
          throw new Error(`Error al subir archivo: ${uploadError.message}`);
        }

        // Update source with storage path
        await supabase
          .from("rag_sources")
          .update({ storage_path: storagePath })
          .eq("id", source.id);

        toast.success("Documento cargado. Debe ser aprobado antes de procesarse.");
      } else if (documentForm.source_type === "URL") {
        if (!documentForm.url) {
          toast.error("Ingresá una URL válida");
          setIsUploadingDocument(false);
          return;
        }

        const { error: sourceError } = await supabase
          .from("rag_sources")
          .insert({
            tenant_id: activeTenantId,
            offer_id: offerId,
            source_type: "URL",
            name: documentForm.name || "URL",
            description: documentForm.description || null,
            source_url: documentForm.url,
            is_active: false,
            approval_status: 'DRAFT',
          });

        if (sourceError) throw sourceError;
        toast.success("URL agregada. Debe ser aprobada antes de procesarse.");
      } else if (documentForm.source_type === "MANUAL") {
        if (!documentForm.content) {
          toast.error("Ingresá el contenido del documento");
          setIsUploadingDocument(false);
          return;
        }

        const { error: sourceError } = await supabase
          .from("rag_sources")
          .insert({
            tenant_id: activeTenantId,
            offer_id: offerId,
            source_type: "MANUAL",
            name: documentForm.name || "Documento manual",
            description: documentForm.description || null,
            is_active: false,
            approval_status: 'DRAFT',
          });

        if (sourceError) throw sourceError;
        toast.success("Documento creado. Debe ser aprobado antes de procesarse.");
      }

      // Reset form and reload
      setDocumentForm({ source_type: "PDF", name: "", description: "", url: "", content: "" });
      setPdfFile(null);
      setShowDocumentModal(false);
      setEditingDocument(null);
      await loadOfferData();
    } catch (error: any) {
      console.error("Error submitting document:", error);
      toast.error(error?.message || "Error al cargar el documento");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function handleEditDocument(doc: RagSource) {
    setEditingDocument(doc);
    setDocumentForm({
      source_type: doc.source_type,
      name: doc.name,
      description: doc.description || "",
      url: doc.source_url || "",
      content: "",
    });
    setShowDocumentModal(true);
  }

  async function handleUpdateDocument() {
    if (!editingDocument || !canManageOffers) return;

    setIsUploadingDocument(true);
    const supabase = createClient();

    try {
      const updateData: any = {
        name: documentForm.name,
        description: documentForm.description || null,
        updated_at: new Date().toISOString(),
      };

      if (documentForm.source_type === "URL") {
        updateData.source_url = documentForm.url;
      }

      // If PDF file is provided, upload new version
      if (documentForm.source_type === "PDF" && pdfFile) {
        const storagePath = `${activeTenantId}/${offerId}/${editingDocument.id}/${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("rag-documents")
          .upload(storagePath, pdfFile, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) throw uploadError;
        updateData.storage_path = storagePath;
      }

      const { error } = await supabase
        .from("rag_sources")
        .update(updateData)
        .eq("id", editingDocument.id);

      if (error) throw error;

      toast.success("Documento actualizado");
      setShowDocumentModal(false);
      setEditingDocument(null);
      setDocumentForm({ source_type: "PDF", name: "", description: "", url: "", content: "" });
      setPdfFile(null);
      await loadOfferData();
    } catch (error: any) {
      console.error("Error updating document:", error);
      toast.error(error?.message || "Error al actualizar el documento");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!canManageOffers) return;

    setDeletingDocumentId(docId);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("rag_sources")
        .delete()
        .eq("id", docId);

      if (error) throw error;

      toast.success("Documento eliminado");
      await loadOfferData();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error("Error al eliminar el documento");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function handleSubmitForApproval(docId: string) {
    if (!canManageOffers) return;

    const supabase = createClient();

    try {
      const { error } = await (supabase.rpc as any)("submit_rag_source_for_approval", {
        p_source_id: docId,
      });

      if (error) throw error;

      toast.success("Documento enviado para aprobación");
      await loadOfferData();
    } catch (error: any) {
      console.error("Error submitting for approval:", error);
      toast.error(error?.message || "Error al enviar para aprobación");
    }
  }

  // No bloqueo completo - siempre mostrar estructura

  if (!offer) {
    return null;
  }

  // Standardize funnel data
  const standardizedFunnel = funnel ? standardizeFunnelStats(funnel) : null;
  
  // Funnel stage data for visualization - using standardized names
  const funnelStages = standardizedFunnel ? [
    { 
      label: TENANT_FUNNEL_STAGES.find(s => s.key === "received")?.label || "Recibidos", 
      value: standardizedFunnel.received, 
      color: "bg-slate-500" 
    },
    { 
      label: TENANT_FUNNEL_STAGES.find(s => s.key === "in_chat")?.label || "En Chat", 
      value: standardizedFunnel.in_chat, 
      color: "bg-blue-500" 
    },
    { 
      label: TENANT_FUNNEL_STAGES.find(s => s.key === "qualified")?.label || "Calificados", 
      value: standardizedFunnel.qualified, 
      color: "bg-purple-500" 
    },
    { 
      label: TENANT_FUNNEL_STAGES.find(s => s.key === "delivered")?.label || "Entregados", 
      value: standardizedFunnel.delivered, 
      color: "bg-emerald-500" 
    },
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
          <div className="flex items-center gap-2">
            {canManageOffers && (
              <Button
                variant="secondary"
                onClick={() => router.push(`/portal/offers/${offerId}/edit`)}
                leftIcon={<Edit className="h-4 w-4" />}
              >
                Editar
              </Button>
            )}
            {canManageOffers && offer.approval_status === 'APPROVED' && (
              <Button
                variant="secondary"
                onClick={handlePauseResume}
                isLoading={isPausing}
                leftIcon={offer.status === 'PAUSED' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              >
                {offer.status === 'PAUSED' ? 'Reanudar' : 'Pausar'}
              </Button>
            )}
          </div>
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
              leftIcon={<Edit className="h-3 w-3" />}
            >
              Editar y reenviar
            </Button>
          )}
        </div>
      )}

      {/* Funnel Stats */}
      {isLoading ? (
        <div className="relative mb-6 rounded-xl overflow-hidden min-h-[450px] bg-[var(--bg-primary)]">
          <div className="relative z-20 p-6 max-w-2xl">
            <Card className="bg-[var(--bg-primary)]/98 backdrop-blur-md border-[var(--border-primary)] shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-4 h-48">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center space-y-2">
                      <Skeleton className="h-8 w-12" />
                      <Skeleton className="h-3 w-8" />
                      <Skeleton className="w-full h-24 rounded-t-lg" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--border-primary)] flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : funnel && funnel.total_leads > 0 ? (
        <>
          {/* Funnel Visualization with Background Image */}
          <div className="relative mb-6 rounded-xl overflow-hidden min-h-[450px] bg-[var(--bg-primary)]">
            {/* Background Image - Right Side */}
            {offer.image_url && (
              <div className="absolute inset-0 flex items-center justify-end pointer-events-none">
                {/* Gradient overlay to ensure cards are readable */}
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/90 via-[var(--bg-primary)]/70 to-transparent z-10" />
                {/* Image container - positioned to the right */}
                <div className="relative w-[55%] h-full z-0">
                  <Image
                    src={offer.image_url}
                    alt={offer.name}
                    fill
                    className="object-cover object-center"
                  />
                  {/* Additional gradient from left edge of image */}
                  <div className="absolute inset-0 bg-gradient-to-l from-[var(--bg-primary)]/60 via-transparent to-transparent" />
                </div>
              </div>
            )}
            
            {/* Cards Content - Left Side */}
            <div className="relative z-20 p-6 max-w-2xl">
              <Card className="bg-[var(--bg-primary)]/98 backdrop-blur-md border-[var(--border-primary)] shadow-lg">
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
                        <div key={stage.label} className="flex-1 flex flex-col items-center relative">
                          <span className="text-2xl font-bold text-[var(--text-primary)] mb-1">{stage.value}</span>
                          <span className="text-xs text-[var(--text-tertiary)] mb-2">{percentage}%</span>
                          <div 
                            className={`w-full rounded-t-lg ${stage.color} transition-all duration-500`}
                            style={{ height: `${Math.max(height, 5)}%` }}
                          />
                          <span className="text-sm text-[var(--text-secondary)] mt-2 text-center">{stage.label}</span>
                          {idx < funnelStages.length - 1 && (
                            <ChevronRight className="absolute h-4 w-4 text-[var(--text-tertiary)]" style={{ right: '-0.75rem' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Conversion rate */}
                  <div className="mt-6 pt-4 border-t border-[var(--border-primary)] flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Tasa de conversión</span>
                    <span className="text-2xl font-bold text-[var(--accent-primary)]">{funnel.conversion_rate}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

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
      ) : null}

      {/* Empty state for no leads */}
      {!isLoading && (!funnel || funnel.total_leads === 0) && (
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
      {isLoading ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardHeader>
          <div className="divide-y divide-[var(--border-primary)]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="h-10 w-10 rounded-full" variant="circular" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
      ) : deliveredLeads.length > 0 ? (
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
      ) : null}

      {/* Integrations Section */}
      {canManageOffers && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[var(--text-secondary)]" />
                Integraciones
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">
              Configurá cómo se entregan los leads calificados a tus sistemas.
            </p>
            
            <div className="space-y-3">
              {/* Google Sheets */}
              {(() => {
                const googleIntegration = integrations.find(i => i.integration_type === "GOOGLE_SHEETS");
                return (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                        <LinkIcon className="h-5 w-5 text-[var(--text-secondary)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Google Sheets</p>
                        <p className="text-sm text-[var(--text-tertiary)]">
                          {googleIntegration?.is_active 
                            ? `Conectado${googleIntegration.name ? `: ${googleIntegration.name}` : ''}`
                            : "No configurado"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIntegrationModalType("GOOGLE_SHEETS");
                        setEditingIntegration(googleIntegration || null);
                        setShowIntegrationModal(true);
                      }}
                    >
                      {googleIntegration ? "Editar" : "Configurar"}
                    </Button>
                  </div>
                );
              })()}

              {/* Tokko */}
              {(() => {
                const tokkoIntegration = integrations.find(i => i.integration_type === "TOKKO");
                return (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                        <LinkIcon className="h-5 w-5 text-[var(--text-secondary)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Tokko</p>
                        <p className="text-sm text-[var(--text-tertiary)]">
                          {tokkoIntegration?.is_active 
                            ? `Conectado${tokkoIntegration.name ? `: ${tokkoIntegration.name}` : ''}`
                            : "No configurado"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIntegrationModalType("TOKKO");
                        setEditingIntegration(tokkoIntegration || null);
                        setShowIntegrationModal(true);
                      }}
                    >
                      {tokkoIntegration ? "Editar" : "Configurar"}
                    </Button>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentos relevantes de la Oferta */}
      {canManageOffers && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
                Documentos relevantes de la Oferta
              </CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingDocument(null);
                  setDocumentForm({ source_type: "PDF", name: "", description: "", url: "", content: "" });
                  setPdfFile(null);
                  setShowDocumentModal(true);
                }}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Agregar documento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">
              Agregá documentos, URLs o texto que contengan información relevante sobre este proyecto. 
              Los documentos deben ser aprobados por Converzia antes de procesarse.
            </p>
            
            {ragSources.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p className="text-[var(--text-secondary)] mb-2">No hay documentos cargados</p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Agregá documentos para que el sistema pueda responder mejor las preguntas sobre este proyecto.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ragSources.map((doc) => {
                  const approvalStatusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "info" | "danger" }> = {
                    DRAFT: { label: "Borrador", variant: "secondary" },
                    PENDING_APPROVAL: { label: "Pendiente de aprobación", variant: "info" },
                    APPROVED: { label: "Aprobado", variant: "success" },
                    REJECTED: { label: "Rechazado", variant: "danger" },
                  };
                  const statusConfig = approvalStatusConfig[doc.approval_status] || { label: doc.approval_status, variant: "secondary" as const };
                  const canEdit = doc.approval_status === 'DRAFT' || doc.approval_status === 'REJECTED';
                  
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                          {doc.source_type === "PDF" ? (
                            <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
                          ) : doc.source_type === "URL" ? (
                            <LinkIcon className="h-5 w-5 text-[var(--text-secondary)]" />
                          ) : (
                            <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-[var(--text-primary)]">{doc.name}</p>
                            <Badge variant={statusConfig.variant} size="sm">
                              {statusConfig.label}
                            </Badge>
                          </div>
                          {doc.description && (
                            <p className="text-sm text-[var(--text-tertiary)]">{doc.description}</p>
                          )}
                          {doc.source_url && (
                            <a
                              href={doc.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[var(--text-secondary)] hover:underline flex items-center gap-1 mt-1"
                            >
                              <LinkIcon className="h-3 w-3" />
                              {doc.source_url}
                            </a>
                          )}
                          {doc.approval_status === 'REJECTED' && doc.rejection_reason && (
                            <div className="mt-2 p-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                              <p className="text-xs text-[var(--text-secondary)]">
                                <strong>Motivo de rechazo:</strong> {doc.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDocument(doc)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {doc.approval_status === 'DRAFT' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSubmitForApproval(doc.id)}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Enviar para aprobación
                              </Button>
                            )}
                          </>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("¿Estás seguro de que querés eliminar este documento?")) {
                                handleDeleteDocument(doc.id);
                              }
                            }}
                            isLoading={deletingDocumentId === doc.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Modal */}
      <Modal
        isOpen={showDocumentModal}
        onClose={() => {
          setShowDocumentModal(false);
          setEditingDocument(null);
          setDocumentForm({ source_type: "PDF", name: "", description: "", url: "", content: "" });
          setPdfFile(null);
        }}
        title={editingDocument ? "Editar documento" : "Agregar documento"}
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Tipo de documento"
            options={[
              { value: "PDF", label: "PDF" },
              { value: "URL", label: "URL" },
              { value: "MANUAL", label: "Texto manual" },
            ]}
            value={documentForm.source_type}
            onChange={(e) => setDocumentForm({ ...documentForm, source_type: e.target.value as any })}
            disabled={!!editingDocument}
          />

          <Input
            label="Nombre"
            placeholder="Ej: Información del proyecto"
            value={documentForm.name}
            onChange={(e) => setDocumentForm({ ...documentForm, name: e.target.value })}
            required
          />

          <TextArea
            label="Descripción (opcional)"
            placeholder="Breve descripción del documento..."
            rows={2}
            value={documentForm.description}
            onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
          />

          {documentForm.source_type === "PDF" && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Archivo PDF
              </label>
              <div className="border-2 border-dashed border-[var(--border-primary)] rounded-lg p-6 text-center">
                {pdfFile ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">{pdfFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPdfFile(null)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-[var(--text-tertiary)]" />
                    <p className="text-sm text-[var(--text-secondary)] mb-1">
                      Hacé click para seleccionar un PDF
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">PDF hasta 10MB</p>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type !== "application/pdf") {
                            toast.error("Solo se permiten archivos PDF");
                            return;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error("El archivo no puede superar los 10MB");
                            return;
                          }
                          setPdfFile(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {documentForm.source_type === "URL" && (
            <Input
              label="URL"
              placeholder="https://..."
              type="url"
              value={documentForm.url}
              onChange={(e) => setDocumentForm({ ...documentForm, url: e.target.value })}
              required
            />
          )}

          {documentForm.source_type === "MANUAL" && (
            <TextArea
              label="Contenido"
              placeholder="Ingresá el contenido del documento..."
              rows={6}
              value={documentForm.content}
              onChange={(e) => setDocumentForm({ ...documentForm, content: e.target.value })}
              required
            />
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
            <Info className="h-4 w-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[var(--text-secondary)]">
              Los documentos deben ser aprobados por Converzia antes de procesarse e ingresar al sistema.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDocumentModal(false);
                setEditingDocument(null);
                setDocumentForm({ source_type: "PDF", name: "", description: "", url: "", content: "" });
                setPdfFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={editingDocument ? handleUpdateDocument : handleSubmitDocument}
              isLoading={isUploadingDocument}
            >
              {editingDocument ? "Guardar cambios" : "Crear documento"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Integration Config Modal */}
      {showIntegrationModal && activeTenantId && (
        <IntegrationConfigModal
          isOpen={showIntegrationModal}
          onClose={() => {
            setShowIntegrationModal(false);
            setEditingIntegration(null);
          }}
          onSuccess={() => {
            setShowIntegrationModal(false);
            setEditingIntegration(null);
            loadOfferData();
            toast.success("Integración configurada correctamente");
          }}
          type={integrationModalType}
          tenantId={activeTenantId}
          existingConfig={editingIntegration?.config as any}
          existingIntegrationId={editingIntegration?.id}
        />
      )}
    </PageContainer>
  );
}

