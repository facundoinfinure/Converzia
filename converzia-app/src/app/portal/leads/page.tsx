"use client";

import { useState } from "react";
import { Users, Phone, Mail, Calendar, MessageSquare, Download, CheckCircle, XCircle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { AdvancedFilters, FilterConfig } from "@/components/ui/AdvancedFilters";
import { BulkActions } from "@/components/ui/BulkActions";
import { Badge, LeadStatusBadge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { NoLeadsEmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { usePortalLeads } from "@/lib/hooks/use-portal";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatRelativeTime, formatDate, formatPhone, downloadCSV } from "@/lib/utils";
import type { LeadOffer, QualificationFields, ScoreBreakdown } from "@/types";

// Lead statuses for tabs
const statuses = [
  { value: "", label: "Todos" },
  { value: "LEAD_READY", label: "Lead Ready" },
  { value: "SENT_TO_DEVELOPER", label: "Entregados" },
  { value: "QUALIFYING", label: "En calificación" },
  { value: "CONTACTED", label: "Contactados" },
];

export default function PortalLeadsPage() {
  const { hasPermission, activeTenantId } = useAuth();
  const toast = useToast();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<LeadOffer | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  const { leads, total, isLoading, refetch } = usePortalLeads({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  const handleExport = () => {
    if (!hasPermission("leads:export")) return;

    const exportData = leads.map((l) => ({
      Nombre: l.lead?.full_name || "",
      Telefono: l.lead?.phone || "",
      Email: l.lead?.email || "",
      Estado: l.status,
      Oferta: l.offer?.name || "",
      Score: l.score_total || "",
      Fecha: l.created_at,
    }));

    downloadCSV(exportData, `leads-${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedLeads.length === 0 || !activeTenantId) return;

    try {
      await queryWithTimeout(
        supabase
          .from("lead_offers")
          .update({
            status: newStatus,
            status_changed_at: new Date().toISOString(),
          })
          .in("id", selectedLeads)
          .eq("tenant_id", activeTenantId),
        30000,
        "bulk update lead status"
      );

      toast.success(`${selectedLeads.length} lead(s) actualizado(s)`);
      setSelectedLeads([]);
      refetch();
    } catch (error) {
      toast.error("Error al actualizar leads");
    }
  };

  // Filter config
  const filterConfig: FilterConfig[] = [
    {
      key: "score_min",
      label: "Score Mínimo",
      type: "number",
      placeholder: "Mínimo",
    },
    {
      key: "score_max",
      label: "Score Máximo",
      type: "number",
      placeholder: "Máximo",
    },
    {
      key: "created_date",
      label: "Fecha de Creación",
      type: "dateRange",
    },
    {
      key: "offer",
      label: "Oferta",
      type: "select",
      options: [], // Would need to fetch offers
    },
  ];

  const columns: Column<LeadOffer>[] = [
    {
      key: "lead",
      header: "Lead",
      cell: (l) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary-400" />
          </div>
          <div>
            <button
              onClick={() => setSelectedLead(l)}
              className="font-medium text-white hover:text-primary-400 transition-colors text-left"
            >
              {l.lead?.full_name || l.lead?.phone || "Lead"}
            </button>
            {l.lead?.email && (
              <p className="text-sm text-slate-500">{l.lead.email}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (l) => (
        <a
          href={`tel:${l.lead?.phone}`}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <Phone className="h-4 w-4" />
          {l.lead?.phone ? formatPhone(l.lead.phone) : "-"}
        </a>
      ),
    },
    {
      key: "offer",
      header: "Oferta",
      cell: (l) => (
        <span className="text-slate-300">{l.offer?.name || "Sin asignar"}</span>
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
        l.score_total ? (
          <div className="flex items-center gap-2">
            <div className="w-12 h-2 rounded-full bg-card-border overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${l.score_total}%` }}
              />
            </div>
            <span className="text-sm text-slate-400">{l.score_total}</span>
          </div>
        ) : (
          <span className="text-slate-600">-</span>
        )
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (l) => (
        <span className="text-slate-400 text-sm">
          {formatRelativeTime(l.created_at)}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        description="Todos los leads de tus campañas"
        actions={
          hasPermission("leads:export") && (
            <Button
              variant="secondary"
              onClick={handleExport}
              leftIcon={<Download className="h-4 w-4" />}
              disabled={leads.length === 0}
            >
              Exportar
            </Button>
          )
        }
      />

      <Card>
        {/* Filters */}
        <div className="p-4 border-b border-card-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, teléfono o email..."
              className="flex-1 max-w-md"
            />

            <div className="flex items-center gap-1">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    setStatusFilter(s.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === s.value
                      ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                      : "text-slate-400 hover:text-white hover:bg-card-border"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <AdvancedFilters
                filters={filterConfig}
                values={filterValues}
                onChange={setFilterValues}
                onReset={() => setFilterValues({})}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={leads}
          columns={columns}
          keyExtractor={(l) => l.id}
          isLoading={isLoading}
          onRowClick={setSelectedLead}
          selectable
          selectedRows={selectedLeads}
          onSelectionChange={setSelectedLeads}
          emptyState={<NoLeadsEmptyState />}
        />

        {/* Bulk Actions */}
        <BulkActions
          selectedCount={selectedLeads.length}
          selectedIds={selectedLeads}
          actions={[
            {
              label: "Marcar como Lead Ready",
              icon: <CheckCircle className="h-4 w-4" />,
              onClick: () => handleBulkStatusChange("LEAD_READY"),
              variant: "primary",
              confirmMessage: `¿Marcar ${selectedLeads.length} lead(s) como Lead Ready?`,
            },
            {
              label: "Marcar como Entregado",
              icon: <CheckCircle className="h-4 w-4" />,
              onClick: () => handleBulkStatusChange("SENT_TO_DEVELOPER"),
              variant: "primary",
              confirmMessage: `¿Marcar ${selectedLeads.length} lead(s) como Entregado?`,
            },
          ]}
          onClear={() => setSelectedLeads([])}
        />

        {/* Pagination */}
        {total > 20 && (
          <div className="p-4 border-t border-card-border">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 20)}
              totalItems={total}
              pageSize={20}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Lead Detail Modal */}
      <Modal
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title="Detalle del Lead"
        size="lg"
      >
        {selectedLead && (
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-card-border/50">
              <div className="h-14 w-14 rounded-full bg-primary-500/20 flex items-center justify-center">
                <Users className="h-7 w-7 text-primary-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedLead.lead?.full_name || "Lead"}
                </h3>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  {selectedLead.lead?.phone && (
                    <a href={`tel:${selectedLead.lead.phone}`} className="flex items-center gap-1 hover:text-white">
                      <Phone className="h-4 w-4" />
                      {formatPhone(selectedLead.lead.phone)}
                    </a>
                  )}
                  {selectedLead.lead?.email && (
                    <a href={`mailto:${selectedLead.lead.email}`} className="flex items-center gap-1 hover:text-white">
                      <Mail className="h-4 w-4" />
                      {selectedLead.lead.email}
                    </a>
                  )}
                </div>
              </div>
              <div className="ml-auto">
                <LeadStatusBadge status={selectedLead.status} />
              </div>
            </div>

            {/* Score */}
            {selectedLead.score_total && (
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-3">Score de calificación</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 rounded-full bg-card-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      style={{ width: `${selectedLead.score_total}%` }}
                    />
                  </div>
                  <span className="text-2xl font-bold text-white">{selectedLead.score_total}</span>
                </div>

                {selectedLead.score_breakdown && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {Object.entries(selectedLead.score_breakdown as ScoreBreakdown).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-2 rounded bg-card-border/50">
                        <span className="text-sm text-slate-400 capitalize">{key.replace("_", " ")}</span>
                        <span className="text-sm font-medium text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Qualification Fields */}
            {selectedLead.qualification_fields && Object.keys(selectedLead.qualification_fields).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-3">Información extraída</h4>
                <div className="space-y-2">
                  {Object.entries(selectedLead.qualification_fields as QualificationFields).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between py-2 border-b border-card-border last:border-0">
                      <span className="text-slate-400 capitalize">{key.replace("_", " ")}</span>
                      <span className="text-white text-right max-w-[60%]">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-3">Historial</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-card-border flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Creado</p>
                    <p className="text-xs text-slate-500">{formatDate(selectedLead.created_at)}</p>
                  </div>
                </div>
                {selectedLead.first_response_at && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-card-border flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm text-white">Primera respuesta</p>
                      <p className="text-xs text-slate-500">{formatDate(selectedLead.first_response_at)}</p>
                    </div>
                  </div>
                )}
                {selectedLead.qualified_at && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Users className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white">Calificado</p>
                      <p className="text-xs text-slate-500">{formatDate(selectedLead.qualified_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}

