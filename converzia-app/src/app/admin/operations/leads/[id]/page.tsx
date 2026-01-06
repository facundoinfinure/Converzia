"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  User,
  Building2,
  Package,
  MessageSquare,
  Clock,
  Calendar,
  ChevronRight,
  Send,
  Bot,
  UserCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  DollarSign,
  MapPin,
  Home,
  Zap,
  RefreshCw,
  FileText,
  History,
  Settings,
  MoreVertical,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, LeadStatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatRelativeTime, formatDate, formatCurrency, cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface LeadDetail {
  id: string;
  lead_id: string;
  status: string;
  score_total: number | null;
  score_breakdown: Record<string, number> | null;
  qualification_fields: any;
  contact_attempts: number;
  billing_eligibility: string | null;
  billing_notes: string | null;
  first_response_at: string | null;
  created_at: string;
  updated_at: string;
  lead: {
    id: string;
    phone: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    country_code: string;
    opted_out: boolean;
    first_contact_at: string | null;
    last_contact_at: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  offer: {
    id: string;
    name: string;
    city: string | null;
    zone: string | null;
  } | null;
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  sender: "LEAD" | "BOT" | "OPERATOR" | "SYSTEM";
  content: string;
  media_type: string | null;
  media_url: string | null;
  sent_at: string;
  extracted_data: any;
}

interface LeadEvent {
  id: string;
  event_type: string;
  details: any;
  actor_type: string | null;
  created_at: string;
}

interface Delivery {
  id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  error_message: string | null;
  integrations_succeeded: string[];
  integrations_failed: string[];
}

interface Props {
  params: Promise<{ id: string }>;
}

// Event type labels
const eventTypeLabels: Record<string, string> = {
  STATUS_CHANGE: "Cambio de estado",
  MESSAGE_RECEIVED: "Mensaje recibido",
  MESSAGE_SENT: "Mensaje enviado",
  SCORE_UPDATED: "Score actualizado",
  QUALIFICATION_UPDATED: "Calificación actualizada",
  DELIVERY_ATTEMPTED: "Intento de entrega",
  DELIVERY_SUCCESS: "Entrega exitosa",
  DELIVERY_FAILED: "Entrega fallida",
  LEAD_CREATED: "Lead creado",
  OPTED_OUT: "Opt-out",
};

export default function LeadDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [leadOffer, setLeadOffer] = useState<LeadDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("conversation");
  
  const supabase = createClient();
  
  const loadData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Load lead offer details
      const { data: leadOfferData, error: leadOfferError } = await queryWithTimeout(
        supabase
          .from("lead_offers")
          .select(`
            id,
            lead_id,
            status,
            score_total,
            score_breakdown,
            qualification_fields,
            contact_attempts,
            billing_eligibility,
            billing_notes,
            first_response_at,
            created_at,
            updated_at,
            lead:leads(id, phone, email, first_name, last_name, full_name, country_code, opted_out, first_contact_at, last_contact_at),
            tenant:tenants(id, name, slug),
            offer:offers(id, name, city, zone)
          `)
          .eq("id", id)
          .single(),
        10000,
        "lead offer detail"
      );
      
      if (leadOfferError || !leadOfferData) {
        console.error("Error fetching lead offer:", leadOfferError);
        toast.error("Error al cargar el lead");
        return;
      }
      
      // Process nested relations (Supabase returns arrays for single relations)
      const rawData = leadOfferData as any;
      const processedData: LeadDetail = {
        ...rawData,
        lead: Array.isArray(rawData.lead) ? rawData.lead[0] : rawData.lead,
        tenant: Array.isArray(rawData.tenant) ? rawData.tenant[0] : rawData.tenant,
        offer: Array.isArray(rawData.offer) ? rawData.offer[0] : rawData.offer,
      };
      
      setLeadOffer(processedData);
      
      // Load conversation messages
      const { data: conversationData } = await queryWithTimeout<{ id: string }[]>(
        supabase
          .from("conversations")
          .select("id")
          .eq("lead_id", processedData.lead.id)
          .eq("tenant_id", processedData.tenant.id)
          .order("created_at", { ascending: false })
          .limit(1),
        10000,
        "conversation lookup"
      );
      
      if (conversationData && Array.isArray(conversationData) && conversationData.length > 0) {
        const conversationId = conversationData[0].id;
        
        const { data: messagesData } = await queryWithTimeout<Message[]>(
          supabase
            .from("messages")
            .select("id, direction, sender, content, media_type, media_url, sent_at, extracted_data")
            .eq("conversation_id", conversationId)
            .order("sent_at", { ascending: true }),
          15000,
          "messages"
        );
        
        if (messagesData && Array.isArray(messagesData)) {
          setMessages(messagesData);
        }
      }
      
      // Load lead events
      const { data: eventsData } = await queryWithTimeout<LeadEvent[]>(
        supabase
          .from("lead_events")
          .select("id, event_type, details, actor_type, created_at")
          .eq("lead_offer_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        10000,
        "lead events"
      );
      
      if (eventsData && Array.isArray(eventsData)) {
        setEvents(eventsData);
      }
      
      // Load deliveries
      const { data: deliveriesData } = await queryWithTimeout<Delivery[]>(
        supabase
          .from("deliveries")
          .select("id, status, created_at, delivered_at, error_message, integrations_succeeded, integrations_failed")
          .eq("lead_offer_id", id)
          .order("created_at", { ascending: false }),
        10000,
        "deliveries"
      );
      
      if (deliveriesData && Array.isArray(deliveriesData)) {
        setDeliveries(deliveriesData);
      }
      
    } catch (error) {
      console.error("Error loading lead data:", error);
      toast.error("Error al cargar datos del lead");
    } finally {
      setIsLoading(false);
    }
  }, [id, supabase, toast]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  useEffect(() => {
    // Scroll to bottom of messages when they change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </PageContainer>
    );
  }
  
  if (!leadOffer) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-400 mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Lead no encontrado</h2>
          <p className="text-[var(--text-tertiary)] mb-4">No se pudo encontrar el lead solicitado.</p>
          <Link href="/admin/operations">
            <Button>Volver a Operaciones</Button>
          </Link>
        </div>
      </PageContainer>
    );
  }
  
  const qual = leadOffer.qualification_fields || {};
  
  return (
    <PageContainer>
      <PageHeader
        title={leadOffer.lead.full_name || leadOffer.lead.phone}
        description={`Lead ID: ${leadOffer.lead_id.slice(0, 8)}...`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Operaciones", href: "/admin/operations" },
          { label: "Detalle del Lead" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <LeadStatusBadge status={leadOffer.status} />
            <ActionDropdown
              items={[
                { label: "Ver en Chatwoot", icon: <MessageSquare className="h-4 w-4" />, onClick: () => {} },
                { label: "Reintentar entrega", icon: <RefreshCw className="h-4 w-4" />, onClick: () => {} },
                { label: "", divider: true },
                { label: "Marcar como STOPPED", icon: <XCircle className="h-4 w-4" />, onClick: () => {}, danger: true },
              ] as any}
            />
          </div>
        }
      />
      
      {/* Lead Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Lead Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-400" />
              Información del Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  Contacto
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-tertiary)]">Teléfono</p>
                      <a href={`tel:${leadOffer.lead.phone}`} className="text-[var(--text-primary)] hover:text-primary-400">
                        {leadOffer.lead.phone}
                      </a>
                    </div>
                  </div>
                  
                  {leadOffer.lead.email && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-tertiary)]">Email</p>
                        <a href={`mailto:${leadOffer.lead.email}`} className="text-[var(--text-primary)] hover:text-primary-400">
                          {leadOffer.lead.email}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-tertiary)]">Tenant</p>
                      <Link href={`/admin/tenants/${leadOffer.tenant.id}`} className="text-[var(--text-primary)] hover:text-primary-400">
                        {leadOffer.tenant.name}
                      </Link>
                    </div>
                  </div>
                  
                  {leadOffer.offer && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-tertiary)]">Oferta</p>
                        <Link href={`/admin/offers/${leadOffer.offer.id}`} className="text-[var(--text-primary)] hover:text-primary-400">
                          {leadOffer.offer.name}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Metrics */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  Métricas
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <span className="text-sm text-[var(--text-secondary)]">Score</span>
                    </div>
                    <span className={cn(
                      "font-semibold",
                      (leadOffer.score_total || 0) >= 70 ? "text-emerald-400" :
                      (leadOffer.score_total || 0) >= 40 ? "text-amber-400" : "text-red-400"
                    )}>
                      {leadOffer.score_total ?? "-"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <span className="text-sm text-[var(--text-secondary)]">Intentos de contacto</span>
                    </div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {leadOffer.contact_attempts}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <span className="text-sm text-[var(--text-secondary)]">Creado</span>
                    </div>
                    <span className="text-sm text-[var(--text-primary)]">
                      {formatDate(leadOffer.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <span className="text-sm text-[var(--text-secondary)]">Última actividad</span>
                    </div>
                    <span className="text-sm text-[var(--text-primary)]">
                      {formatRelativeTime(leadOffer.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Qualification Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              Calificación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qual.budget && (
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Presupuesto</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {qual.budget.min && qual.budget.max 
                      ? `${formatCurrency(qual.budget.min, qual.budget.currency || 'USD')} - ${formatCurrency(qual.budget.max, qual.budget.currency || 'USD')}`
                      : qual.budget.max
                        ? `Hasta ${formatCurrency(qual.budget.max, qual.budget.currency || 'USD')}`
                        : qual.budget.min
                          ? `Desde ${formatCurrency(qual.budget.min, qual.budget.currency || 'USD')}`
                          : "-"
                    }
                  </p>
                </div>
              </div>
            )}
            
            {qual.zone && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Zona</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {Array.isArray(qual.zone) ? qual.zone.join(", ") : qual.zone}
                  </p>
                </div>
              </div>
            )}
            
            {qual.bedrooms && (
              <div className="flex items-start gap-3">
                <Home className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Ambientes</p>
                  <p className="text-sm text-[var(--text-primary)]">{qual.bedrooms} ambientes</p>
                </div>
              </div>
            )}
            
            {qual.timing && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Timing</p>
                  <p className="text-sm text-[var(--text-primary)]">{qual.timing}</p>
                </div>
              </div>
            )}
            
            {qual.purpose && (
              <div className="flex items-start gap-3">
                <Target className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Propósito</p>
                  <p className="text-sm text-[var(--text-primary)] capitalize">{qual.purpose}</p>
                </div>
              </div>
            )}
            
            {qual.financing !== undefined && (
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Financiamiento</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {qual.financing ? "Requiere financiamiento" : "Sin financiamiento"}
                    {qual.pre_approved && " (Pre-aprobado)"}
                  </p>
                </div>
              </div>
            )}
            
            {qual.notes && (
              <div className="pt-3 border-t border-[var(--border-primary)]">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Notas</p>
                <p className="text-sm text-[var(--text-secondary)]">{qual.notes}</p>
              </div>
            )}
            
            {Object.keys(qual).length === 0 && (
              <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                Sin datos de calificación
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs: Conversation, Timeline, Deliveries */}
      <Tabs defaultValue="conversation" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabTrigger value="conversation" count={messages.length}>
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Conversación
          </TabTrigger>
          <TabTrigger value="timeline" count={events.length}>
            <History className="h-4 w-4 mr-1.5" />
            Timeline
          </TabTrigger>
          <TabTrigger value="deliveries" count={deliveries.length}>
            <Send className="h-4 w-4 mr-1.5" />
            Entregas
          </TabTrigger>
        </TabsList>
        
        {/* Conversation Tab */}
        <TabContent value="conversation">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Conversación</CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-[var(--text-tertiary)] mb-4" />
                  <p className="text-[var(--text-tertiary)]">No hay mensajes registrados</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {messages.map((message, index) => {
                    const isInbound = message.direction === "INBOUND";
                    const prevMessage = messages[index - 1];
                    const showTimestamp = !prevMessage || 
                      new Date(message.sent_at).getTime() - new Date(prevMessage.sent_at).getTime() > 300000;
                    
                    return (
                      <div key={message.id}>
                        {showTimestamp && (
                          <div className="flex justify-center my-4">
                            <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-3 py-1 rounded-full">
                              {formatDate(message.sent_at)} - {new Date(message.sent_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        
                        <div className={cn(
                          "flex gap-3",
                          isInbound ? "justify-start" : "justify-end"
                        )}>
                          {isInbound && (
                            <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                              <UserCircle className="h-5 w-5 text-slate-300" />
                            </div>
                          )}
                          
                          <div className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5",
                            isInbound 
                              ? "bg-[var(--bg-tertiary)] rounded-tl-md" 
                              : message.sender === "BOT"
                                ? "bg-primary-600/20 text-primary-100 rounded-tr-md"
                                : "bg-emerald-600/20 text-emerald-100 rounded-tr-md"
                          )}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs opacity-60">
                                {new Date(message.sent_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {!isInbound && (
                                <span className="text-xs opacity-60 flex items-center gap-1">
                                  {message.sender === "BOT" ? (
                                    <>
                                      <Bot className="h-3 w-3" /> Bot
                                    </>
                                  ) : (
                                    <>
                                      <UserCircle className="h-3 w-3" /> Operador
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                            
                            {/* Show extracted data if present */}
                            {message.extracted_data && Object.keys(message.extracted_data).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <p className="text-xs opacity-60 mb-1">Datos extraídos:</p>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(message.extracted_data).map(([key, value]) => (
                                    <Badge key={key} variant="outline" size="sm">
                                      {key}: {String(value)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {!isInbound && (
                            <div className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                              message.sender === "BOT" 
                                ? "bg-primary-600/30" 
                                : "bg-emerald-600/30"
                            )}>
                              {message.sender === "BOT" ? (
                                <Bot className="h-5 w-5 text-primary-300" />
                              ) : (
                                <UserCircle className="h-5 w-5 text-emerald-300" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>
        
        {/* Timeline Tab */}
        <TabContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Timeline de Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto text-[var(--text-tertiary)] mb-4" />
                  <p className="text-[var(--text-tertiary)]">No hay eventos registrados</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--border-primary)]" />
                  
                  <div className="space-y-4">
                    {events.map((event) => (
                      <div key={event.id} className="flex gap-4 relative">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center z-10",
                          event.event_type === "STATUS_CHANGE" ? "bg-primary-500/20" :
                          event.event_type.includes("DELIVERY_SUCCESS") ? "bg-emerald-500/20" :
                          event.event_type.includes("DELIVERY_FAILED") ? "bg-red-500/20" :
                          "bg-[var(--bg-tertiary)]"
                        )}>
                          {event.event_type === "STATUS_CHANGE" && <Activity className="h-4 w-4 text-primary-400" />}
                          {event.event_type === "MESSAGE_RECEIVED" && <MessageSquare className="h-4 w-4 text-blue-400" />}
                          {event.event_type === "MESSAGE_SENT" && <Send className="h-4 w-4 text-emerald-400" />}
                          {event.event_type.includes("DELIVERY_SUCCESS") && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                          {event.event_type.includes("DELIVERY_FAILED") && <XCircle className="h-4 w-4 text-red-400" />}
                          {!["STATUS_CHANGE", "MESSAGE_RECEIVED", "MESSAGE_SENT"].includes(event.event_type) && 
                           !event.event_type.includes("DELIVERY") && <FileText className="h-4 w-4 text-[var(--text-tertiary)]" />}
                        </div>
                        
                        <div className="flex-1 bg-[var(--bg-secondary)] rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">
                                {eventTypeLabels[event.event_type] || event.event_type}
                              </p>
                              {event.details && (
                                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                                  {event.details.from && event.details.to && (
                                    <>De <Badge variant="secondary" size="sm">{event.details.from}</Badge> a <Badge variant="primary" size="sm">{event.details.to}</Badge></>
                                  )}
                                  {event.details.message && event.details.message}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {formatRelativeTime(event.created_at)}
                              </p>
                              {event.actor_type && (
                                <Badge variant="outline" size="sm" className="mt-1">
                                  {event.actor_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>
        
        {/* Deliveries Tab */}
        <TabContent value="deliveries">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Entregas</CardTitle>
            </CardHeader>
            <CardContent>
              {deliveries.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto text-[var(--text-tertiary)] mb-4" />
                  <p className="text-[var(--text-tertiary)]">No hay entregas registradas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deliveries.map((delivery) => (
                    <div key={delivery.id} className="border border-[var(--border-primary)] rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {delivery.status === "DELIVERED" && (
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                              <CheckCircle className="h-5 w-5 text-emerald-400" />
                            </div>
                          )}
                          {delivery.status === "FAILED" && (
                            <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                              <XCircle className="h-5 w-5 text-red-400" />
                            </div>
                          )}
                          {delivery.status === "PENDING" && (
                            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                              <Clock className="h-5 w-5 text-amber-400" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={
                                  delivery.status === "DELIVERED" ? "success" : 
                                  delivery.status === "FAILED" ? "danger" : "warning"
                                }
                              >
                                {delivery.status}
                              </Badge>
                              <span className="text-sm text-[var(--text-tertiary)]">
                                {formatRelativeTime(delivery.created_at)}
                              </span>
                            </div>
                            {delivery.delivered_at && (
                              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                                Entregado: {formatDate(delivery.delivered_at)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {delivery.status === "FAILED" && (
                          <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />}>
                            Reintentar
                          </Button>
                        )}
                      </div>
                      
                      {delivery.error_message && (
                        <div className="mt-3 p-2 bg-red-500/10 rounded border border-red-500/20">
                          <p className="text-sm text-red-400">{delivery.error_message}</p>
                        </div>
                      )}
                      
                      {(delivery.integrations_succeeded?.length > 0 || delivery.integrations_failed?.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {delivery.integrations_succeeded?.map((int) => (
                            <Badge key={int} variant="success" size="sm">{int}</Badge>
                          ))}
                          {delivery.integrations_failed?.map((int) => (
                            <Badge key={int} variant="danger" size="sm">{int}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>
    </PageContainer>
  );
}

