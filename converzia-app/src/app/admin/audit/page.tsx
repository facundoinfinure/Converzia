"use client";

import { useState } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Building2,
  Activity,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useAuditLogs, type AuditLog } from "@/lib/react-query/queries/audit";
import { usePagination } from "@/lib/hooks/use-pagination";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

// Action types for filter
const ACTION_OPTIONS = [
  { value: "", label: "Todas las acciones" },
  { value: "tenant_created", label: "Tenant Creado" },
  { value: "user_invited", label: "Usuario Invitado" },
  { value: "user_role_changed", label: "Rol Cambiado" },
  { value: "credit_purchased", label: "Créditos Comprados" },
  { value: "credit_refunded", label: "Créditos Reembolsados" },
  { value: "lead_pii_deleted", label: "PII Eliminado (GDPR)" },
  { value: "integration_connected", label: "Integración Conectada" },
  { value: "integration_disconnected", label: "Integración Desconectada" },
];

// Entity types for filter
const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "tenant", label: "Tenant" },
  { value: "user", label: "Usuario" },
  { value: "tenant_member", label: "Miembro" },
  { value: "credit_ledger", label: "Créditos" },
  { value: "lead", label: "Lead" },
  { value: "integration", label: "Integración" },
  { value: "billing_order", label: "Orden de Facturación" },
];

export default function AuditPage() {
  const { page, setPage, pageSize, setPageSize } = usePagination({
    initialPage: 1,
    initialPageSize: 25,
  });

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filters = {
    ...(actionFilter && { action: actionFilter }),
    ...(entityTypeFilter && { entity_type: entityTypeFilter }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  };

  const { data, isLoading } = useAuditLogs({
    page,
    pageSize,
    filters,
  });

  const logs = data?.data || [];
  const total = data?.total || 0;

  const handleExport = () => {
    // Simple CSV export
    const csvData = [
      [
        "Fecha",
        "Acción",
        "Tipo",
        "Usuario",
        "Tenant",
        "ID Entidad",
        "IP",
      ],
      ...logs.map((log) => [
        formatDate(log.created_at),
        log.action,
        log.entity_type,
        log.user_email || "N/A",
        log.tenant_name || "N/A",
        log.entity_id || "N/A",
        log.ip_address || "N/A",
      ]),
    ];

    const csv = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const columns: Column<AuditLog>[] = [
    {
      key: "created_at",
      header: "Fecha",
      render: (log: AuditLog) => (
        <div>
          <div className="text-sm font-medium">
            {formatDate(log.created_at)}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {formatRelativeTime(log.created_at)}
          </div>
        </div>
      ),
      sortable: false,
    },
    {
      key: "action",
      header: "Acción",
      render: (log: AuditLog) => (
        <Badge variant="outline" className="font-mono text-xs">
          {log.action}
        </Badge>
      ),
      sortable: false,
    },
    {
      key: "entity_type",
      header: "Tipo",
      render: (log: AuditLog) => (
        <Badge variant="secondary">{log.entity_type}</Badge>
      ),
      sortable: false,
    },
    {
      key: "user_id",
      header: "Usuario",
      render: (log: AuditLog) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-[var(--text-tertiary)]" />
          <span className="text-sm">
            {log.user_email || log.user_id?.substring(0, 8) || "Sistema"}
          </span>
        </div>
      ),
      sortable: false,
    },
    {
      key: "tenant_id",
      header: "Tenant",
      render: (log: AuditLog) =>
        log.tenant_name ? (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--text-tertiary)]" />
            <span className="text-sm">{log.tenant_name}</span>
          </div>
        ) : (
          <span className="text-sm text-[var(--text-tertiary)]">N/A</span>
        ),
      sortable: false,
    },
    {
      key: "actions",
      header: "Acciones",
      render: (log: AuditLog) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedLog(log)}
          leftIcon={<Eye className="h-4 w-4" />}
        >
          Ver
        </Button>
      ),
      sortable: false,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Audit Logs"
        description="Registro de auditoría de acciones críticas en el sistema"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Audit Logs" },
        ]}
        actions={
          <Button
            variant="secondary"
            onClick={handleExport}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Exportar CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Tipo de Acción
              </label>
              <CustomSelect
                options={ACTION_OPTIONS}
                value={actionFilter}
                onChange={(value) => setActionFilter(value as string)}
                placeholder="Filtrar por acción"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Tipo de Entidad
              </label>
              <CustomSelect
                options={ENTITY_TYPE_OPTIONS}
                value={entityTypeFilter}
                onChange={(value) => setEntityTypeFilter(value as string)}
                placeholder="Filtrar por tipo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Fecha Desde
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Fecha Hasta
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          {(actionFilter || entityTypeFilter || dateFrom || dateTo) && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionFilter("");
                  setEntityTypeFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Registros de Auditoría ({total})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="No hay registros de auditoría"
              description={
                filters.action || filters.entity_type || filters.date_from
                  ? "No se encontraron registros con los filtros aplicados"
                  : "Aún no hay registros de auditoría en el sistema"
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      {columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]"
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        {columns.map((col, idx) => (
                          <td key={idx} className="py-3 px-4">
                            {col.render ? col.render(log, idx) : String((log as unknown as Record<string, unknown>)[col.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(total / pageSize)}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                  totalItems={total}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Detalles del Registro de Auditoría"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Fecha
              </label>
              <p className="mt-1">{formatDate(selectedLog.created_at)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Acción
              </label>
              <p className="mt-1 font-mono text-sm">{selectedLog.action}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Tipo de Entidad
              </label>
              <p className="mt-1">{selectedLog.entity_type}</p>
            </div>
            {selectedLog.entity_id && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  ID de Entidad
                </label>
                <p className="mt-1 font-mono text-xs">{selectedLog.entity_id}</p>
              </div>
            )}
            {selectedLog.user_email && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  Usuario
                </label>
                <p className="mt-1">{selectedLog.user_email}</p>
              </div>
            )}
            {selectedLog.tenant_name && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  Tenant
                </label>
                <p className="mt-1">{selectedLog.tenant_name}</p>
              </div>
            )}
            {selectedLog.old_values && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  Valores Anteriores
                </label>
                <pre className="mt-1 p-3 bg-[var(--bg-tertiary)] rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.old_values, null, 2)}
                </pre>
              </div>
            )}
            {selectedLog.new_values && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  Valores Nuevos
                </label>
                <pre className="mt-1 p-3 bg-[var(--bg-tertiary)] rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.new_values, null, 2)}
                </pre>
              </div>
            )}
            {selectedLog.metadata && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  Metadata
                </label>
                <pre className="mt-1 p-3 bg-[var(--bg-tertiary)] rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
            {selectedLog.ip_address && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  IP Address
                </label>
                <p className="mt-1 font-mono text-sm">{selectedLog.ip_address}</p>
              </div>
            )}
            {selectedLog.user_agent && (
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  User Agent
                </label>
                <p className="mt-1 text-xs">{selectedLog.user_agent}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
