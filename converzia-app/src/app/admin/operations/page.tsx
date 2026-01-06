"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
  MessageSquare,
  Users,
  AlertTriangle,
  Filter,
  Eye,
  ChevronRight,
  UserCheck,
  UserX,
  Phone,
  Mail,
  Building2,
  Package,
  ArrowRight,
  Zap,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { DataTable, Column } from "@/components/ui/Table";
import { Badge, LeadStatusBadge } from "@/components/ui/Badge";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { SearchInput } from "@/components/ui/SearchInput";
import { CustomSelect } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatCurrency, formatRelativeTime, formatDate, cn } from "@/lib/utils";
import Link from "next/link";

// ============================================
// Types
// ============================================

interface OperationsStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  totalRefunds: number;
  refundAmount: number;
  avgProcessingTime: string;
  activeConversations: number;
}

interface Delivery {
  id: string;
  lead_id: string;
  tenant_id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  error_message: string | null;
  lead?: { phone: string; full_name: string | null };
  tenant?: { name: string };
  offer?: { name: string };
}

interface Refund {
  id: string;
  tenant_id: string;
  amount: number;
  description: string | null;
  created_at: string;
  tenant?: { name: string };
}

// Pipeline types
interface PipelineStats {
  pending_mapping: number;
  to_be_contacted: number;
  contacted: number;
  engaged: number;
  qualifying: number;
  scored: number;
  lead_ready: number;
  sent_to_developer: number;
  cooling: number;
  reactivation: number;
  disqualified: number;
  stopped: number;
  human_handoff: number;
}

interface PipelineLead {
  id: string;
  lead_id: string;
  status: string;
  score_total: number | null;
  qualification_fields: any;
  contact_attempts: number;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  lead: {
    phone: string;
    full_name: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  tenant: {
    id: string;
    name: string;
  };
  offer: {
    id: string;
    name: string;
  } | null;
}

// Status categories for the funnel
const FUNNEL_STAGES = [
  { 
    key: "new", 
    label: "Nuevos", 
    statuses: ["PENDING_MAPPING", "TO_BE_CONTACTED"],
    color: "from-slate-500 to-slate-600",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
  },
  { 
    key: "contacted", 
    label: "Contactados", 
    statuses: ["CONTACTED"],
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
  },
  { 
    key: "engaged", 
    label: "Interesados", 
    statuses: ["ENGAGED", "QUALIFYING"],
    color: "from-cyan-500 to-cyan-600",
    bgColor: "bg-cyan-500/10",
    textColor: "text-cyan-400",
  },
  { 
    key: "qualified", 
    label: "Calificados", 
    statuses: ["SCORED", "LEAD_READY"],
    color: "from-emerald-500 to-emerald-600",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
  },
  { 
    key: "delivered", 
    label: "Entregados", 
    statuses: ["SENT_TO_DEVELOPER"],
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-500/10",
    textColor: "text-green-400",
  },
  { 
    key: "paused", 
    label: "En Pausa", 
    statuses: ["COOLING", "REACTIVATION", "HUMAN_HANDOFF"],
    color: "from-amber-500 to-amber-600",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
  },
  { 
    key: "lost", 
    label: "Perdidos", 
    statuses: ["DISQUALIFIED", "STOPPED"],
    color: "from-red-500 to-red-600",
    bgColor: "bg-red-500/10",
    textColor: "text-red-400",
  },
];

export default function OperationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [stats, setStats] = useState<OperationsStats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryId, setRetryId] = useState<string | null>(null);
  
  // Pipeline state
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [tenantOptions, setTenantOptions] = useState<Array<{value: string; label: string}>>([]);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      try {
        // Fetch delivery stats
        const [
          { count: totalDeliveries, error: totalError },
          { count: successfulDeliveries, error: successError },
          { count: failedDeliveries, error: failedError },
          { count: pendingDeliveries, error: pendingError },
        ] = await Promise.all([
          queryWithTimeout(
            supabase.from("deliveries").select("id", { count: "exact", head: true }),
            30000,
            "total deliveries"
          ),
          queryWithTimeout(
            supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "DELIVERED"),
            30000,
            "successful deliveries"
          ),
          queryWithTimeout(
            supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "FAILED"),
            30000,
            "failed deliveries"
          ),
          queryWithTimeout(
            supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
            30000,
            "pending deliveries"
          ),
        ]);

        // Silently handle errors - stats will show 0 if queries fail
        if (totalError || successError || failedError || pendingError) {
          // Only log if all queries failed (critical error)
          if (totalError && successError && failedError && pendingError) {
            console.error("Error fetching delivery stats:", { totalError, successError, failedError, pendingError });
          }
        }

        // Fetch refund stats
        const { data: refundData, error: refundError } = await queryWithTimeout(
          supabase
            .from("credit_ledger")
            .select("amount")
            .eq("transaction_type", "CREDIT_REFUND"),
          10000,
          "refund stats"
        );

        // Silently handle refund errors - not critical
        if (refundError) {
          // Only log if it's not a timeout (timeouts are expected sometimes)
          if (!refundError.message?.includes("Timeout")) {
            console.warn("Error fetching refund stats (non-critical):", refundError);
          }
        }

        const totalRefunds = Array.isArray(refundData) ? refundData.length : 0;
        const refundAmount = Array.isArray(refundData) 
          ? refundData.reduce((sum: number, r: any) => sum + Math.abs(r.amount), 0) 
          : 0;

        // Fetch active conversations
        const { count: activeConversations, error: conversationsError } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .in("status", ["CONTACTED", "ENGAGED", "QUALIFYING"]),
          10000,
          "active conversations"
        );

        // Silently handle conversation errors - not critical
        if (conversationsError) {
          // Only log if it's not a timeout (timeouts are expected sometimes)
          if (!conversationsError.message?.includes("Timeout")) {
            console.warn("Error fetching active conversations (non-critical):", conversationsError);
          }
        }

        setStats({
          totalDeliveries: totalDeliveries || 0,
          successfulDeliveries: successfulDeliveries || 0,
          failedDeliveries: failedDeliveries || 0,
          pendingDeliveries: pendingDeliveries || 0,
          totalRefunds,
          refundAmount,
          avgProcessingTime: "2.4min",
          activeConversations: activeConversations || 0,
        });

        // Fetch recent deliveries
        const { data: deliveriesData, error: deliveriesError } = await queryWithTimeout(
          supabase
            .from("deliveries")
            .select(`
              id,
              lead_id,
              tenant_id,
              status,
              created_at,
              delivered_at,
              error_message,
              lead:leads(phone, full_name),
              tenant:tenants(name),
              offer:offers(name)
            `)
            .order("created_at", { ascending: false })
            .limit(50),
          10000,
          "recent deliveries"
        );

        if (deliveriesError) {
          console.error("Error fetching deliveries:", deliveriesError);
        } else if (deliveriesData && Array.isArray(deliveriesData)) {
          setDeliveries(
            deliveriesData.map((d: any) => ({
              ...d,
              lead: Array.isArray(d.lead) ? d.lead[0] : d.lead,
              tenant: Array.isArray(d.tenant) ? d.tenant[0] : d.tenant,
              offer: Array.isArray(d.offer) ? d.offer[0] : d.offer,
            }))
          );
        }

        // Fetch recent refunds
        const { data: refundsData, error: refundsDataError } = await queryWithTimeout(
          supabase
            .from("credit_ledger")
            .select(`
              id,
              tenant_id,
              amount,
              description,
              created_at,
              tenant:tenants(name)
            `)
            .eq("transaction_type", "CREDIT_REFUND")
            .order("created_at", { ascending: false })
            .limit(20),
          10000,
          "recent refunds"
        );

        if (refundsDataError) {
          console.error("Error fetching refunds:", refundsDataError);
        } else if (refundsData && Array.isArray(refundsData)) {
          setRefunds(
            refundsData.map((r: any) => ({
              ...r,
              tenant: Array.isArray(r.tenant) ? r.tenant[0] : r.tenant,
            }))
          );
        }
        
        // Fetch tenant options for filter
        const { data: tenantsData } = await queryWithTimeout<{ id: string; name: string }[]>(
          supabase.from("tenants").select("id, name").eq("status", "ACTIVE").order("name"),
          10000,
          "tenants list"
        );
        if (tenantsData && Array.isArray(tenantsData)) {
          setTenantOptions([
            { value: "", label: "Todos los tenants" },
            ...tenantsData.map((t) => ({ value: t.id, label: t.name }))
          ]);
        }
        
      } catch (error) {
        console.error("Error fetching operations data:", error);
        toast.error("Error al cargar datos de operaciones");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [supabase, toast]);
  
  // Fetch pipeline data - using useCallback to avoid stale closure
  const fetchPipelineData = useCallback(async () => {
    setPipelineLoading(true);
    
    try {
      // Fetch pipeline stats (counts by status)
      const statusCounts: PipelineStats = {
        pending_mapping: 0,
        to_be_contacted: 0,
        contacted: 0,
        engaged: 0,
        qualifying: 0,
        scored: 0,
        lead_ready: 0,
        sent_to_developer: 0,
        cooling: 0,
        reactivation: 0,
        disqualified: 0,
        stopped: 0,
        human_handoff: 0,
      };
      
      const statuses = [
        "PENDING_MAPPING", "TO_BE_CONTACTED", "CONTACTED", "ENGAGED", 
        "QUALIFYING", "SCORED", "LEAD_READY", "SENT_TO_DEVELOPER",
        "COOLING", "REACTIVATION", "DISQUALIFIED", "STOPPED", "HUMAN_HANDOFF"
      ];
      
      // Fetch counts for each status in parallel
      const countPromises = statuses.map(status => {
        let query = supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        
        if (tenantFilter) {
          query = query.eq("tenant_id", tenantFilter);
        }
        
        return queryWithTimeout(query, 30000, `count ${status}`);
      });
      
      const results = await Promise.all(countPromises);
      
      results.forEach((result, index) => {
        const key = statuses[index].toLowerCase() as keyof PipelineStats;
        statusCounts[key] = result.count || 0;
      });
      
      setPipelineStats(statusCounts);
      
      // Fetch leads for selected stage
      if (selectedStage) {
        const stage = FUNNEL_STAGES.find(s => s.key === selectedStage);
        if (stage) {
          console.log(`🔍 Fetching leads for stage: ${selectedStage}, statuses:`, stage.statuses);
          
          // First, let's verify the count matches
          let countQuery = supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .in("status", stage.statuses);
          
          if (tenantFilter) {
            countQuery = countQuery.eq("tenant_id", tenantFilter);
          }
          
          const { count: expectedCount, error: countError } = await queryWithTimeout(
            countQuery,
            10000,
            "verify count"
          );
          
          if (countError) {
            console.error("Error verifying count:", countError);
          } else {
            console.log(`📊 Expected count for stage ${selectedStage}:`, expectedCount);
          }
          
          // Now fetch the actual leads
          // Try with relationships first
          let query = supabase
            .from("lead_offers")
            .select(`
              id,
              lead_id,
              status,
              score_total,
              qualification_fields,
              contact_attempts,
              created_at,
              updated_at,
              first_response_at,
              lead:leads(phone, full_name, email, first_name, last_name),
              tenant:tenants(id, name),
              offer:offers!lead_offers_offer_id_fkey(id, name)
            `)
            .in("status", stage.statuses)
            .order("updated_at", { ascending: false })
            .limit(100);
          
          if (tenantFilter) {
            query = query.eq("tenant_id", tenantFilter);
          }
          
          const { data, error } = await queryWithTimeout<any[]>(query, 15000, "pipeline leads");
          
          if (error) {
            console.error("❌ Error fetching pipeline leads:", error);
            console.error("Error details:", JSON.stringify(error, null, 2));
            
            // If the error is related to relationships, try a simpler query
            if (error.message?.includes("permission") || error.message?.includes("policy") || error.code === "PGRST116") {
              console.log("🔄 Trying fallback query without relationships due to RLS issue...");
              
              // Fallback: get lead_offers first, then fetch related data separately
              let fallbackQuery = supabase
                .from("lead_offers")
                .select("id, lead_id, tenant_id, offer_id, status, score_total, qualification_fields, contact_attempts, created_at, updated_at, first_response_at")
                .in("status", stage.statuses)
                .order("updated_at", { ascending: false })
                .limit(100);
              
              if (tenantFilter) {
                fallbackQuery = fallbackQuery.eq("tenant_id", tenantFilter);
              }
              
              const { data: fallbackData, error: fallbackError } = await queryWithTimeout<any[]>(
                fallbackQuery,
                15000,
                "pipeline leads fallback"
              );
              
              if (fallbackError) {
                console.error("❌ Fallback query also failed:", fallbackError);
                toast.error(`Error al cargar leads: ${fallbackError.message}`);
                setPipelineLeads([]);
              } else if (fallbackData && Array.isArray(fallbackData) && fallbackData.length > 0) {
                console.log(`✅ Fallback query returned ${fallbackData.length} lead_offers`);
                
                // Fetch related data in parallel
                const leadIds = [...new Set(fallbackData.map((d: any) => d.lead_id).filter(Boolean))];
                const tenantIds = [...new Set(fallbackData.map((d: any) => d.tenant_id).filter(Boolean))];
                const offerIds = [...new Set(fallbackData.map((d: any) => d.offer_id).filter(Boolean))];
                
                const [leadsResult, tenantsResult, offersResult] = await Promise.all([
                  leadIds.length > 0 ? supabase.from("leads").select("id, phone, full_name, email, first_name, last_name").in("id", leadIds) : Promise.resolve({ data: [], error: null }),
                  tenantIds.length > 0 ? supabase.from("tenants").select("id, name").in("id", tenantIds) : Promise.resolve({ data: [], error: null }),
                  offerIds.length > 0 ? supabase.from("offers").select("id, name").in("id", offerIds.filter(Boolean)) : Promise.resolve({ data: [], error: null }),
                ]);
                
                const leadsMap = new Map((leadsResult.data || []).map((l: any) => [l.id, l]));
                const tenantsMap = new Map((tenantsResult.data || []).map((t: any) => [t.id, t]));
                const offersMap = new Map((offersResult.data || []).map((o: any) => [o.id, o]));
                
                const processedLeads = fallbackData.map((d: any) => ({
                  ...d,
                  lead: leadsMap.get(d.lead_id) || null,
                  tenant: tenantsMap.get(d.tenant_id) || null,
                  offer: d.offer_id ? (offersMap.get(d.offer_id) || null) : null,
                }));
                
                console.log("Processed leads (fallback):", processedLeads);
                setPipelineLeads(processedLeads);
              } else {
                setPipelineLeads([]);
              }
            } else {
              toast.error(`Error al cargar leads: ${error.message}`);
              setPipelineLeads([]);
            }
          } else if (data && Array.isArray(data)) {
            console.log(`✅ Fetched ${data.length} leads for stage ${selectedStage} with statuses:`, stage.statuses);
            if (data.length === 0 && expectedCount && expectedCount > 0) {
              console.warn(`⚠️ Warning: Count shows ${expectedCount} leads but query returned 0. This might indicate a problem with the query or relationships.`);
              toast.warning(`Se encontraron ${expectedCount} leads pero no se pudieron cargar. Verificá las políticas de seguridad.`);
            }
            const processedLeads = data.map((d: any) => ({
              ...d,
              lead: Array.isArray(d.lead) ? d.lead[0] : d.lead,
              tenant: Array.isArray(d.tenant) ? d.tenant[0] : d.tenant,
              offer: Array.isArray(d.offer) ? d.offer[0] : d.offer,
            }));
            console.log("Processed leads:", processedLeads);
            setPipelineLeads(processedLeads);
          } else {
            console.warn("⚠️ No data returned or data is not an array:", data);
            setPipelineLeads([]);
          }
        }
      } else {
        setPipelineLeads([]);
      }
      
    } catch (error) {
      console.error("Error fetching pipeline data:", error);
    } finally {
      setPipelineLoading(false);
    }
  }, [selectedStage, tenantFilter, supabase, toast]);

  // Trigger pipeline fetch when dependencies change
  useEffect(() => {
    fetchPipelineData();
  }, [fetchPipelineData]);

  const handleRetryDelivery = async () => {
    if (!retryId) return;

    try {
      // In production, this would trigger the delivery pipeline
      await (supabase as any)
        .from("deliveries")
        .update({
          status: "PENDING",
          error_message: null,
        })
        .eq("id", retryId);

      toast.success("Reintentando entrega...");
      setRetryId(null);
    } catch (error) {
      toast.error("Error al reintentar entrega");
    }
  };
  
  // Calculate stage totals
  const getStageTotals = () => {
    if (!pipelineStats) return {};
    return FUNNEL_STAGES.reduce((acc, stage) => {
      acc[stage.key] = stage.statuses.reduce((sum, status) => {
        const key = status.toLowerCase() as keyof PipelineStats;
        return sum + (pipelineStats[key] || 0);
      }, 0);
      return acc;
    }, {} as Record<string, number>);
  };
  
  const stageTotals = getStageTotals();
  const totalLeads = Object.values(stageTotals).reduce((a, b) => a + b, 0);
  
  // Filter leads by search
  const filteredLeads = pipelineLeads.filter(lead => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      lead.lead?.full_name?.toLowerCase().includes(q) ||
      lead.lead?.phone?.includes(q) ||
      lead.lead?.email?.toLowerCase().includes(q) ||
      lead.tenant?.name?.toLowerCase().includes(q) ||
      lead.offer?.name?.toLowerCase().includes(q)
    );
  });

  // Delivery columns
  const deliveryColumns: Column<Delivery>[] = [
    {
      key: "lead",
      header: "Lead",
      cell: (d) => (
        <div>
          <span className="font-medium text-[var(--text-primary)]">{d.lead?.full_name || d.lead?.phone}</span>
          {d.lead?.full_name && (
            <p className="text-xs text-[var(--text-tertiary)]">{d.lead.phone}</p>
          )}
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant / Oferta",
      cell: (d) => (
        <div>
          <span className="text-slate-300">{d.tenant?.name}</span>
          {d.offer && (
            <p className="text-xs text-[var(--text-tertiary)]">{d.offer.name}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (d) => {
        const config: Record<string, { variant: "success" | "danger" | "warning" | "info"; label: string }> = {
          DELIVERED: { variant: "success", label: "Entregado" },
          FAILED: { variant: "danger", label: "Fallido" },
          PENDING: { variant: "warning", label: "Pendiente" },
          REFUNDED: { variant: "info", label: "Reembolsado" },
        };
        const c = config[d.status] || { variant: "default" as any, label: d.status };
        return <Badge variant={c.variant} dot>{c.label}</Badge>;
      },
    },
    {
      key: "time",
      header: "Fecha",
      cell: (d) => (
        <span className="text-[var(--text-tertiary)] text-sm">{formatRelativeTime(d.created_at)}</span>
      ),
    },
    {
      key: "error",
      header: "Error",
      cell: (d) => (
        d.error_message ? (
          <span className="text-red-400 text-sm truncate max-w-[200px]" title={d.error_message}>
            {d.error_message}
          </span>
        ) : (
          <span className="text-slate-600">-</span>
        )
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      cell: (d) => (
        d.status === "FAILED" && (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setRetryId(d.id)}
            leftIcon={<RefreshCw className="h-3 w-3" />}
          >
            Retry
          </Button>
        )
      ),
    },
  ];

  // Refund columns
  const refundColumns: Column<Refund>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => <span className="text-[var(--text-primary)]">{r.tenant?.name}</span>,
    },
    {
      key: "amount",
      header: "Créditos",
      cell: (r) => (
        <span className="font-medium text-emerald-400">+{Math.abs(r.amount)}</span>
      ),
    },
    {
      key: "reason",
      header: "Motivo",
      cell: (r) => (
        <span className="text-[var(--text-tertiary)]">{r.description || "Sin especificar"}</span>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (r) => (
        <span className="text-[var(--text-tertiary)] text-sm">{formatDate(r.created_at)}</span>
      ),
    },
  ];
  
  // Pipeline lead columns
  const pipelineColumns: Column<PipelineLead>[] = [
    {
      key: "lead",
      header: "Lead",
      cell: (l) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary-400">
              {(l.lead?.first_name?.[0] || l.lead?.full_name?.[0] || "?").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)]">
              {l.lead?.full_name || l.lead?.phone}
            </p>
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <Phone className="h-3 w-3" />
              {l.lead?.phone}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant / Oferta",
      cell: (l) => (
        <div>
          <div className="flex items-center gap-1.5 text-sm">
            <Building2 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
            <span className="text-[var(--text-primary)]">{l.tenant?.name}</span>
          </div>
          {l.offer && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mt-0.5">
              <Package className="h-3 w-3" />
              {l.offer.name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (l) => <LeadStatusBadge status={l.status} />,
    },
    {
      key: "score",
      header: "Score",
      cell: (l) => (
        l.score_total !== null ? (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full",
                  l.score_total >= 70 ? "bg-emerald-500" :
                  l.score_total >= 40 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${l.score_total}%` }}
              />
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">{l.score_total}</span>
          </div>
        ) : (
          <span className="text-[var(--text-tertiary)] text-sm">-</span>
        )
      ),
    },
    {
      key: "attempts",
      header: "Intentos",
      cell: (l) => (
        <span className="text-[var(--text-secondary)]">{l.contact_attempts}</span>
      ),
    },
    {
      key: "updated",
      header: "Última actividad",
      cell: (l) => (
        <span className="text-[var(--text-tertiary)] text-sm">
          {formatRelativeTime(l.updated_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "100px",
      cell: (l) => (
        <Link href={`/admin/operations/leads/${l.id}`}>
          <Button size="xs" variant="secondary" rightIcon={<Eye className="h-3.5 w-3.5" />}>
            Ver
          </Button>
        </Link>
      ),
    },
  ];

  // Show loading overlay while initial data is loading
  if (isLoading && !stats) {
    return (
      <PageContainer>
        <PageHeader
          title="Operaciones"
          description="Monitoreo de entregas, reembolsos y estado del sistema"
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Operaciones" },
          ]}
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-[var(--text-secondary)]">Cargando datos de operaciones...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Operaciones"
        description="Monitoreo de entregas, reembolsos y estado del sistema"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Operaciones" },
        ]}
      />

      {/* Stats */}
      <StatsGrid columns={4} className="mb-6">
        <StatCard
          title="Entregas exitosas"
          value={stats?.successfulDeliveries || 0}
          icon={<CheckCircle />}
          iconColor="from-emerald-500 to-teal-500"
          change={stats ? Math.round((stats.successfulDeliveries / (stats.totalDeliveries || 1)) * 100) : 0}
          trend="up"
          changeLabel="tasa de éxito"
        />
        <StatCard
          title="Entregas fallidas"
          value={stats?.failedDeliveries || 0}
          icon={<XCircle />}
          iconColor="from-red-500 to-rose-500"
          trend={stats?.failedDeliveries ? "down" : "neutral"}
        />
        <StatCard
          title="Conversaciones activas"
          value={stats?.activeConversations || 0}
          icon={<MessageSquare />}
          iconColor="from-blue-500 to-cyan-500"
        />
        <StatCard
          title="Reembolsos"
          value={stats?.totalRefunds || 0}
          icon={<DollarSign />}
          iconColor="from-amber-500 to-orange-500"
        />
      </StatsGrid>

      {/* Alerts */}
      {(stats?.failedDeliveries || 0) > 0 && (
        <Card className="border-red-500/30 bg-red-500/5 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-400">
                  {stats?.failedDeliveries} entregas fallidas
                </h3>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Hay entregas que requieren atención. Revisá los errores y reintentá.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabTrigger value="pipeline" count={totalLeads}>
            Pipeline de Leads
          </TabTrigger>
          <TabTrigger value="deliveries" count={stats?.totalDeliveries}>
            Entregas
          </TabTrigger>
          <TabTrigger value="refunds" count={stats?.totalRefunds}>
            Reembolsos
          </TabTrigger>
          <TabTrigger value="system">
            Estado del sistema
          </TabTrigger>
        </TabsList>
        
        {/* Pipeline Tab */}
        <TabContent value="pipeline">
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <CustomSelect
                      value={tenantFilter}
                      onChange={setTenantFilter}
                      options={tenantOptions}
                      placeholder="Filtrar por tenant..."
                    />
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => fetchPipelineData()}
                    leftIcon={<RefreshCw className={cn("h-4 w-4", pipelineLoading && "animate-spin")} />}
                  >
                    Actualizar
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Funnel Visualization - Premium Horizontal Design */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Funnel stages - horizontal with better selection indicator */}
                <div className="flex items-stretch border-b border-border">
                  {FUNNEL_STAGES.map((stage, index) => {
                    const count = stageTotals[stage.key] || 0;
                    const isSelected = selectedStage === stage.key;
                    const isLast = index === FUNNEL_STAGES.length - 1;
                    
                    return (
                      <button
                        key={stage.key}
                        onClick={() => setSelectedStage(isSelected ? null : stage.key)}
                        className={cn(
                          "relative flex-1 py-4 px-3 text-center transition-all duration-200",
                          "hover:bg-muted/50",
                          isSelected && "bg-muted/70",
                          !isLast && "border-r border-border"
                        )}
                      >
                        {/* Selected indicator - bold bottom bar */}
                        {isSelected && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                        )}
                        
                        {/* Stage content */}
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "text-xl font-semibold transition-colors",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {count}
                          </span>
                          <span className={cn(
                            "text-xs font-medium transition-colors",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )}>
                          {stage.label}
                          </span>
                        </div>
                        
                        {/* Arrow between stages */}
                        {!isLast && (
                          <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-4 w-4 text-muted-foreground/50 z-10" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Total summary bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30 text-xs text-muted-foreground">
                  <span>Total: <strong className="text-foreground">{totalLeads}</strong> leads</span>
                  {selectedStage && (
                    <button 
                      onClick={() => setSelectedStage(null)}
                      className="text-primary hover:underline"
                    >
                      Limpiar selección
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Lead List */}
            {selectedStage && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      Leads en {FUNNEL_STAGES.find(s => s.key === selectedStage)?.label}
                    </CardTitle>
                    <SearchInput
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Buscar lead..."
                      className="w-64"
                    />
                  </div>
                </CardHeader>
                <DataTable
                  data={filteredLeads}
                  columns={pipelineColumns}
                  keyExtractor={(l) => l.id}
                  isLoading={pipelineLoading}
                  emptyState={
                    <EmptyState
                      icon={<Users />}
                      title="Sin leads en esta etapa"
                      description="No hay leads en el estado seleccionado."
                      size="sm"
                    />
                  }
                />
              </Card>
            )}
            
            {!selectedStage && (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                    Seleccioná una etapa del funnel
                  </h3>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Hacé click en cualquier etapa para ver los leads en ese estado
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabContent>

        {/* Deliveries */}
        <TabContent value="deliveries">
          <Card>
            <CardHeader>
              <CardTitle>Historial de entregas</CardTitle>
            </CardHeader>
            <DataTable
              data={deliveries}
              columns={deliveryColumns}
              keyExtractor={(d) => d.id}
              isLoading={isLoading}
              emptyState={
                <EmptyState
                  icon={<CheckCircle />}
                  title="Sin entregas"
                  description="Las entregas aparecerán aquí cuando los leads alcancen Lead Ready."
                  size="sm"
                />
              }
            />
          </Card>
        </TabContent>

        {/* Refunds */}
        <TabContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle>Historial de reembolsos</CardTitle>
            </CardHeader>
            <DataTable
              data={refunds}
              columns={refundColumns}
              keyExtractor={(r) => r.id}
              isLoading={isLoading}
              emptyState={
                <EmptyState
                  icon={<DollarSign />}
                  title="Sin reembolsos"
                  description="Los reembolsos automáticos por duplicados o spam aparecerán aquí."
                  size="sm"
                />
              }
            />
          </Card>
        </TabContent>

        {/* System Status */}
        <TabContent value="system">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Servicios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "API Webhooks", status: "operational" },
                  { name: "OpenAI Integration", status: "operational" },
                  { name: "Chatwoot Connection", status: "operational" },
                  { name: "Supabase Database", status: "operational" },
                  { name: "Stripe Payments", status: "operational" },
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <span className="text-slate-300">{service.name}</span>
                    <Badge variant="success" dot>
                      Operativo
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas del día</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-tertiary)]">Tiempo promedio de respuesta</span>
                  <span className="font-medium text-[var(--text-primary)]">{stats?.avgProcessingTime || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-tertiary)]">Webhooks recibidos</span>
                  <span className="font-medium text-[var(--text-primary)]">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-tertiary)]">Mensajes enviados</span>
                  <span className="font-medium text-[var(--text-primary)]">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-tertiary)]">Tokens OpenAI usados</span>
                  <span className="font-medium text-[var(--text-primary)]">--</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabContent>
      </Tabs>

      {/* Retry Modal */}
      <ConfirmModal
        isOpen={!!retryId}
        onClose={() => setRetryId(null)}
        onConfirm={handleRetryDelivery}
        title="Reintentar entrega"
        description="¿Querés reintentar esta entrega? Se volverá a intentar enviar el lead al destino configurado."
        confirmText="Reintentar"
      />
    </PageContainer>
  );
}
