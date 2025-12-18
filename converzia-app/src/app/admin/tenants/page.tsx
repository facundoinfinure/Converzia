"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Building2, Users, Package, CreditCard, Check, X, Clock, Globe, Phone } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { AdvancedFilters, FilterConfig } from "@/components/ui/AdvancedFilters";
import { BulkActions } from "@/components/ui/BulkActions";
import { TenantStatusBadge } from "@/components/ui/Badge";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { NoTenantsEmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import { useTenants, useTenantMutations } from "@/lib/hooks/use-tenants";
import { useAuth } from "@/lib/auth/context";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { TenantWithStats } from "@/types";

const VERTICAL_LABELS: Record<string, string> = {
  PROPERTY: "Inmobiliaria",
  AUTO: "Automotriz",
  LOAN: "Créditos",
  INSURANCE: "Seguros",
};

export default function TenantsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  const { tenants, total, isLoading, error, refetch } = useTenants({
    search,
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });

  const { updateTenantStatus, deleteTenant, approveTenant, rejectTenant, isLoading: isMutating } = useTenantMutations();

  // Count pending tenants
  const pendingCount = tenants.filter((t) => t.status === "PENDING").length;

  const handleStatusChange = async (id: string, newStatus: TenantWithStats["status"]) => {
    try {
      await updateTenantStatus(id, newStatus);
      toast.success(`Tenant ${newStatus === "ACTIVE" ? "activado" : "actualizado"} correctamente`);
      refetch();
    } catch (error) {
      toast.error("Error al actualizar el tenant");
    }
  };

  const handleApprove = async () => {
    if (!approveId || !user) return;
    try {
      await approveTenant(approveId, user.id);
      toast.success("Tenant aprobado correctamente");
      setApproveId(null);
      refetch();
    } catch (error) {
      toast.error("Error al aprobar el tenant");
    }
  };

  const handleReject = async () => {
    if (!rejectId || !user) return;
    try {
      await rejectTenant(rejectId, rejectReason, user.id);
      toast.success("Tenant rechazado");
      setRejectId(null);
      setRejectReason("");
      refetch();
    } catch (error) {
      toast.error("Error al rechazar el tenant");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTenant(deleteId);
      toast.success("Tenant eliminado correctamente");
      setDeleteId(null);
      refetch();
    } catch (error) {
      toast.error("Error al eliminar el tenant");
    }
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    if (selectedTenants.length === 0 || !user) return;
    try {
      await Promise.all(selectedTenants.map((id) => approveTenant(id, user.id)));
      toast.success(`${selectedTenants.length} tenant(s) aprobado(s)`);
      setSelectedTenants([]);
      refetch();
    } catch (error) {
      toast.error("Error al aprobar tenants");
    }
  };

  const handleBulkReject = async () => {
    if (selectedTenants.length === 0 || !user) return;
    try {
      await Promise.all(selectedTenants.map((id) => rejectTenant(id, "Rechazo masivo", user.id)));
      toast.success(`${selectedTenants.length} tenant(s) rechazado(s)`);
      setSelectedTenants([]);
      refetch();
    } catch (error) {
      toast.error("Error al rechazar tenants");
    }
  };

  // Filter config
  const filterConfig: FilterConfig[] = [
    {
      key: "vertical",
      label: "Vertical",
      type: "select",
      options: [
        { value: "PROPERTY", label: "Inmobiliaria" },
        { value: "AUTO", label: "Automotriz" },
        { value: "LOAN", label: "Créditos" },
        { value: "INSURANCE", label: "Seguros" },
      ],
    },
    {
      key: "credits_min",
      label: "Créditos Mínimos",
      type: "number",
      placeholder: "Mínimo",
    },
    {
      key: "created_date",
      label: "Fecha de Creación",
      type: "dateRange",
    },
  ];

  const columns: Column<TenantWithStats>[] = [
    {
      key: "name",
      header: "Tenant",
      cell: (tenant) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium">
            {tenant.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <Link
              href={`/admin/tenants/${tenant.id}`}
              className="font-medium text-white hover:text-primary-400 transition-colors"
            >
              {tenant.name}
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{tenant.slug}</span>
              {(tenant as any).vertical && (
                <>
                  <span>•</span>
                  <span>{VERTICAL_LABELS[(tenant as any).vertical] || (tenant as any).vertical}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (tenant) => <TenantStatusBadge status={tenant.status} />,
    },
    {
      key: "contact",
      header: "Contacto",
      cell: (tenant) => (
        <div className="text-sm">
          {tenant.contact_email && (
            <div className="text-slate-400">{tenant.contact_email}</div>
          )}
          {tenant.contact_phone && (
            <div className="flex items-center gap-1 text-slate-500">
              <Phone className="h-3 w-3" />
              {tenant.contact_phone}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "stats",
      header: "Estadísticas",
      cell: (tenant) => (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users className="h-4 w-4" />
            <span>{tenant._count?.leads || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Package className="h-4 w-4" />
            <span>{tenant._count?.offers || 0}</span>
          </div>
        </div>
      ),
    },
    {
      key: "credits",
      header: "Créditos",
      cell: (tenant) => (
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-slate-500" />
          <span className={tenant.credit_balance && tenant.credit_balance < 10 ? "text-amber-400" : "text-slate-300"}>
            {tenant.credit_balance || 0}
          </span>
        </div>
      ),
    },
    {
      key: "created",
      header: "Creado",
      cell: (tenant) => (
        <span className="text-slate-400">{formatDate(tenant.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "100px",
      cell: (tenant) => (
        <div className="flex items-center gap-2">
          {tenant.status === "PENDING" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setApproveId(tenant.id);
                }}
                className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                title="Aprobar"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRejectId(tenant.id);
                }}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Rechazar"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
          <ActionDropdown
            items={[
              {
                label: "Ver detalles",
                onClick: () => router.push(`/admin/tenants/${tenant.id}`),
              },
              {
                label: "Editar",
                onClick: () => router.push(`/admin/tenants/${tenant.id}/edit`),
              },
              { divider: true, label: "" },
              tenant.status === "ACTIVE"
                ? {
                    label: "Suspender",
                    onClick: () => handleStatusChange(tenant.id, "SUSPENDED"),
                  }
                : tenant.status === "PENDING"
                ? {
                    label: "Activar",
                    onClick: () => setApproveId(tenant.id),
                  }
                : {
                    label: "Reactivar",
                    onClick: () => handleStatusChange(tenant.id, "ACTIVE"),
                  },
              { divider: true, label: "" },
              {
                label: "Eliminar",
                onClick: () => setDeleteId(tenant.id),
                danger: true,
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Tenants"
        description="Gestiona los tenants de la plataforma"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Tenants" },
        ]}
        actions={
          <Button onClick={() => router.push("/admin/tenants/new")} leftIcon={<Plus className="h-4 w-4" />}>
            Nuevo Tenant
          </Button>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <Card>
        {/* Filters */}
        <div className="p-4 border-b border-card-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, slug o email..."
              className="flex-1 max-w-md"
            />

            <div className="flex items-center gap-2">
              {[
                { value: "", label: "Todos" },
                { value: "PENDING", label: "Pendientes", count: pendingCount },
                { value: "ACTIVE", label: "Activos" },
                { value: "SUSPENDED", label: "Suspendidos" },
              ].map((status) => (
                <button
                  key={status.value}
                  onClick={() => setStatusFilter(status.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                    statusFilter === status.value
                      ? status.value === "PENDING"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                      : "text-slate-400 hover:text-white hover:bg-card-border"
                  }`}
                >
                  {status.value === "PENDING" && <Clock className="h-3.5 w-3.5" />}
                  {status.label}
                  {status.count !== undefined && status.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-500/30">
                      {status.count}
                    </span>
                  )}
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

        {/* Pending Alert */}
        {statusFilter === "" && pendingCount > 0 && (
          <div className="mx-4 mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-400" />
              <div className="flex-1">
                <p className="text-sm text-amber-200">
                  Tenés <strong>{pendingCount}</strong> solicitud{pendingCount > 1 ? "es" : ""} pendiente{pendingCount > 1 ? "s" : ""} de aprobación
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter("PENDING")}
              >
                Ver pendientes
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <DataTable
          data={tenants}
          columns={columns}
          keyExtractor={(t) => t.id}
          isLoading={isLoading}
          loadingRows={5}
          onRowClick={(tenant) => router.push(`/admin/tenants/${tenant.id}`)}
          selectable
          selectedRows={selectedTenants}
          onSelectionChange={setSelectedTenants}
          emptyState={
            statusFilter === "PENDING" ? (
              <div className="py-12 text-center">
                <Clock className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No hay solicitudes pendientes</p>
              </div>
            ) : (
              <NoTenantsEmptyState
                action={{
                  label: "Crear primer tenant",
                  onClick: () => router.push("/admin/tenants/new"),
                }}
              />
            )
          }
        />

        {/* Bulk Actions */}
        <BulkActions
          selectedCount={selectedTenants.length}
          selectedIds={selectedTenants}
          actions={[
            {
              label: "Aprobar",
              icon: <Check className="h-4 w-4" />,
              onClick: async (ids) => {
                if (!user) return;
                try {
                  await Promise.all(ids.map((id) => approveTenant(id, user.id)));
                  toast.success(`${ids.length} tenant(s) aprobado(s)`);
                  setSelectedTenants([]);
                  refetch();
                } catch (error) {
                  toast.error("Error al aprobar tenants");
                }
              },
              variant: "primary",
              confirmMessage: `¿Aprobar ${selectedTenants.length} tenant(s)?`,
            },
            {
              label: "Rechazar",
              icon: <X className="h-4 w-4" />,
              onClick: async (ids) => {
                if (!user) return;
                try {
                  await Promise.all(ids.map((id) => rejectTenant(id, "Rechazo masivo", user.id)));
                  toast.success(`${ids.length} tenant(s) rechazado(s)`);
                  setSelectedTenants([]);
                  refetch();
                } catch (error) {
                  toast.error("Error al rechazar tenants");
                }
              },
              variant: "danger",
              confirmMessage: `¿Rechazar ${selectedTenants.length} tenant(s)?`,
            },
          ]}
          onClear={() => setSelectedTenants([])}
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

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={!!approveId}
        onClose={() => setApproveId(null)}
        onConfirm={handleApprove}
        title="Aprobar tenant"
        description="¿Estás seguro de que querés aprobar este tenant? Se activará su cuenta y podrá acceder a la plataforma."
        confirmText="Aprobar"
        variant="default"
        isLoading={isMutating}
      />

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectId}
        onClose={() => {
          setRejectId(null);
          setRejectReason("");
        }}
        title="Rechazar solicitud"
      >
        <div className="space-y-4">
          <p className="text-slate-400">
            ¿Estás seguro de que querés rechazar esta solicitud? El usuario será notificado.
          </p>
          <TextArea
            label="Motivo del rechazo (opcional)"
            placeholder="Explicá brevemente el motivo..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRejectId(null);
                setRejectReason("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={isMutating}
            >
              Rechazar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar tenant"
        description="¿Estás seguro de que querés eliminar este tenant? Esta acción no se puede deshacer y se eliminarán todos los datos asociados."
        confirmText="Eliminar"
        variant="danger"
        isLoading={isMutating}
      />
    </PageContainer>
  );
}
