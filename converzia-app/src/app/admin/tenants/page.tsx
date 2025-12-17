"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Building2, Users, Package, CreditCard, MoreHorizontal, Search } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { TenantStatusBadge } from "@/components/ui/Badge";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { ConfirmModal } from "@/components/ui/Modal";
import { NoTenantsEmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useTenants, useTenantMutations } from "@/lib/hooks/use-tenants";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { TenantWithStats } from "@/types";

export default function TenantsPage() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { tenants, total, isLoading, refetch } = useTenants({
    search,
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });

  const { updateTenantStatus, deleteTenant, isLoading: isMutating } = useTenantMutations();

  const handleStatusChange = async (id: string, newStatus: TenantWithStats["status"]) => {
    try {
      await updateTenantStatus(id, newStatus);
      toast.success(`Tenant ${newStatus === "ACTIVE" ? "activado" : "actualizado"} correctamente`);
      refetch();
    } catch (error) {
      toast.error("Error al actualizar el tenant");
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
            <p className="text-sm text-slate-500">{tenant.slug}</p>
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
      width: "60px",
      cell: (tenant) => (
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
                  onClick: () => handleStatusChange(tenant.id, "ACTIVE"),
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
              {["", "ACTIVE", "PENDING", "SUSPENDED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                      : "text-slate-400 hover:text-white hover:bg-card-border"
                  }`}
                >
                  {status === "" ? "Todos" : status === "ACTIVE" ? "Activos" : status === "PENDING" ? "Pendientes" : "Suspendidos"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={tenants}
          columns={columns}
          keyExtractor={(t) => t.id}
          isLoading={isLoading}
          loadingRows={5}
          onRowClick={(tenant) => router.push(`/admin/tenants/${tenant.id}`)}
          emptyState={
            <NoTenantsEmptyState
              action={{
                label: "Crear primer tenant",
                onClick: () => router.push("/admin/tenants/new"),
              }}
            />
          }
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

