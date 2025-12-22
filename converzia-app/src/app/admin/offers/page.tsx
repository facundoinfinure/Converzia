"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Package, Users, Layers, Megaphone, MapPin, Building2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { CustomSelect } from "@/components/ui/Select";
import { ConfirmModal } from "@/components/ui/Modal";
import { NoOffersEmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useOffers, useOfferMutations, useTenantOptions } from "@/lib/hooks/use-offers";
import { formatCurrency } from "@/lib/utils";
import type { Offer } from "@/types";

// Status config
const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "default" }> = {
  ACTIVE: { label: "Activo", variant: "success" },
  DRAFT: { label: "Borrador", variant: "secondary" },
  PAUSED: { label: "Pausado", variant: "warning" },
  ARCHIVED: { label: "Archivado", variant: "default" },
};

// Offer type config
const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  PROPERTY: { label: "Inmueble", icon: Building2 },
  AUTO: { label: "Auto", icon: Package },
  LOAN: { label: "Préstamo", icon: Package },
  INSURANCE: { label: "Seguro", icon: Package },
};

export default function OffersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tenantFilter, setTenantFilter] = useState<string>(searchParams.get("tenant") || "");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { offers, total, isLoading, error, refetch } = useOffers({
    tenantId: tenantFilter || undefined,
    search,
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });

  const { deleteOffer, updateOffer, isLoading: isMutating } = useOfferMutations();
  const { options: tenantOptions } = useTenantOptions();

  const handleStatusChange = async (id: string, newStatus: Offer["status"]) => {
    try {
      await updateOffer(id, { status: newStatus });
      toast.success(`Oferta ${newStatus === "ACTIVE" ? "activada" : "actualizada"}`);
      refetch();
    } catch (error) {
      toast.error("Error al actualizar la oferta");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteOffer(deleteId);
      toast.success("Oferta eliminada correctamente");
      setDeleteId(null);
      refetch();
    } catch (error) {
      toast.error("Error al eliminar la oferta");
    }
  };

  const columns: Column<(typeof offers)[0]>[] = [
    {
      key: "name",
      header: "Oferta",
      cell: (offer) => {
        const TypeIcon = typeConfig[offer.offer_type]?.icon || Package;
        return (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              {offer.image_url ? (
                <img
                  src={offer.image_url}
                  alt={offer.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <TypeIcon className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <Link
                href={`/admin/offers/${offer.id}`}
                className="font-medium text-white hover:text-primary-400 transition-colors"
              >
                {offer.name}
              </Link>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-3 w-3" />
                <span>{offer.city || offer.zone || "Sin ubicación"}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (offer) => (
        <Link
          href={`/admin/tenants/${offer.tenant?.id}`}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {offer.tenant?.name || "Sin tenant"}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (offer) => {
        const config = statusConfig[offer.status];
        return (
          <Badge variant={config?.variant || "default"} dot>
            {config?.label || offer.status}
          </Badge>
        );
      },
    },
    {
      key: "price",
      header: "Precio",
      cell: (offer) => (
        <span className="text-slate-300">
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
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-400" title="Variantes">
            <Layers className="h-4 w-4" />
            <span>{offer._count?.variants || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400" title="Leads">
            <Users className="h-4 w-4" />
            <span>{offer._count?.leads || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400" title="Ads mapeados">
            <Megaphone className="h-4 w-4" />
            <span>{offer._count?.ads || 0}</span>
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      cell: (offer) => (
        <ActionDropdown
          items={[
            {
              label: "Ver detalles",
              onClick: () => router.push(`/admin/offers/${offer.id}`),
            },
            {
              label: "Editar",
              onClick: () => router.push(`/admin/offers/${offer.id}/edit`),
            },
            { divider: true, label: "" },
            offer.status === "ACTIVE"
              ? {
                  label: "Pausar",
                  onClick: () => handleStatusChange(offer.id, "PAUSED"),
                }
              : offer.status === "DRAFT" || offer.status === "PAUSED"
              ? {
                  label: "Activar",
                  onClick: () => handleStatusChange(offer.id, "ACTIVE"),
                }
              : {
                  label: "Reactivar",
                  onClick: () => handleStatusChange(offer.id, "ACTIVE"),
                },
            {
              label: "Archivar",
              onClick: () => handleStatusChange(offer.id, "ARCHIVED"),
            },
            { divider: true, label: "" },
            {
              label: "Eliminar",
              onClick: () => setDeleteId(offer.id),
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
        title="Ofertas"
        description="Gestiona las ofertas de todos los tenants"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Ofertas" },
        ]}
        actions={
          <Button
            onClick={() => router.push("/admin/offers/new")}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Nueva Oferta
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
          <div className="flex flex-col lg:flex-row gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, slug o ciudad..."
              className="flex-1 max-w-md"
            />

            <div className="flex flex-wrap items-center gap-3">
              {/* Tenant filter */}
              <CustomSelect
                value={tenantFilter}
                onChange={setTenantFilter}
                options={[{ value: "", label: "Todos los tenants" }, ...tenantOptions]}
                placeholder="Tenant"
                className="w-48"
              />

              {/* Status filters */}
              <div className="flex items-center gap-1">
                {["", "ACTIVE", "DRAFT", "PAUSED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      statusFilter === status
                        ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                        : "text-slate-400 hover:text-white hover:bg-card-border"
                    }`}
                  >
                    {status === ""
                      ? "Todos"
                      : statusConfig[status]?.label || status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={offers}
          columns={columns}
          keyExtractor={(o) => o.id}
          isLoading={isLoading}
          loadingRows={5}
          onRowClick={(offer) => router.push(`/admin/offers/${offer.id}`)}
          emptyState={
            <NoOffersEmptyState
              action={{
                label: "Crear primera oferta",
                onClick: () => router.push("/admin/offers/new"),
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

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar oferta"
        description="¿Estás seguro de que querés eliminar esta oferta? Se eliminarán también todas las variantes, unidades y mapeos de ads asociados."
        confirmText="Eliminar"
        variant="danger"
        isLoading={isMutating}
      />
    </PageContainer>
  );
}








