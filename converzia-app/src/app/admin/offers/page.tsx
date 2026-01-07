"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, Package, Users, Layers, Megaphone, MapPin, Building2, Clock, AlertTriangle, CheckCircle, XCircle, Edit, Trash2, Pause, Play, Archive, Eye } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { FloatingActionButton } from "@/components/layout/BottomNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { CustomSelect } from "@/components/ui/Select";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { NoOffersEmptyState, EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveList, ResponsiveListContainer } from "@/components/ui/ResponsiveList";
import { MobileCard, MobileCardAvatar } from "@/components/ui/MobileCard";
import { ResponsiveActionMenu } from "@/components/ui/ActionDrawer";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { QuickFilters, FilterDrawer, FilterSection, FilterChips } from "@/components/ui/FilterDrawer";
import { useOffers, useOfferMutations, useTenantOptions } from "@/lib/hooks/use-offers";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { usePagination } from "@/lib/hooks/use-pagination";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Offer } from "@/types";

// Status config
const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "default" }> = {
  ACTIVE: { label: "Activo", variant: "success" },
  DRAFT: { label: "Borrador", variant: "secondary" },
  PAUSED: { label: "Pausado", variant: "warning" },
  ARCHIVED: { label: "Archivado", variant: "default" },
};

// Approval status config
const approvalStatusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "default" | "info" | "danger" }> = {
  DRAFT: { label: "Borrador", variant: "secondary" },
  PENDING_APPROVAL: { label: "Pendiente", variant: "info" },
  APPROVED: { label: "Aprobada", variant: "success" },
  REJECTED: { label: "Rechazada", variant: "danger" },
};

// Offer type config
const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  PROPERTY: { label: "Inmueble", icon: Building2 },
  AUTO: { label: "Auto", icon: Package },
  LOAN: { label: "Préstamo", icon: Package },
  INSURANCE: { label: "Seguro", icon: Package },
};

// Tabs
type TabType = "all" | "pending" | "backlog";

export default function OffersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tenantFilter, setTenantFilter] = useState<string>(searchParams.get("tenant") || "");
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPage: 1, initialPageSize: 20 });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Approval/Rejection modal
  const [reviewingOffer, setReviewingOffer] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Pending offers count
  const [pendingCount, setPendingCount] = useState(0);
  const [backlogCount, setBacklogCount] = useState(0);

  const { offers, total, isLoading, error, refetch } = useOffers({
    tenantId: tenantFilter || undefined,
    search,
    status: statusFilter || undefined,
    page,
    pageSize,
  });

  const { deleteOffer, updateOffer, isLoading: isMutating } = useOfferMutations();
  const { options: tenantOptions } = useTenantOptions();

  // Fetch counts for tabs
  useEffect(() => {
    async function fetchCounts() {
      // Pending approval count
      const { count: pending } = await supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "PENDING_APPROVAL");
      setPendingCount(pending || 0);

      // Backlog count (approved but no ad mapped)
      const { data: approvedOffers } = await queryWithTimeout(
        supabase
          .from("offers")
          .select("id")
          .eq("approval_status", "APPROVED")
          .eq("status", "ACTIVE"),
        10000,
        "fetch approved offers"
      );

      if (approvedOffers && Array.isArray(approvedOffers)) {
        const offerIds = (approvedOffers as { id: string }[]).map((o) => o.id);
        const { data: mappedOffers } = await queryWithTimeout(
          supabase
            .from("ad_offer_map")
            .select("offer_id")
            .in("offer_id", offerIds)
            .eq("is_active", true),
          10000,
          "fetch mapped offers"
        );
        
        const mappedList = (mappedOffers as { offer_id: string }[] | null) || [];
        const mappedIds = new Set(mappedList.map((m) => m.offer_id));
        setBacklogCount(offerIds.filter(id => !mappedIds.has(id)).length);
      }
    }
    fetchCounts();
  }, [supabase, offers]);

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

  const handleApprove = async () => {
    if (!reviewingOffer) return;
    setIsProcessing(true);
    
    try {
      const { error } = await (supabase.rpc as Function)("approve_offer", {
        p_offer_id: reviewingOffer.id,
      });
      
      if (error) throw error;
      
      toast.success("Oferta aprobada");
      setReviewingOffer(null);
      refetch();
    } catch (error) {
      toast.error("Error al aprobar la oferta");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!reviewingOffer || !rejectionReason.trim()) {
      toast.error("Debés indicar un motivo de rechazo");
      return;
    }
    setIsProcessing(true);
    
    try {
      const { error } = await (supabase.rpc as Function)("reject_offer", {
        p_offer_id: reviewingOffer.id,
        p_reason: rejectionReason,
      });
      
      if (error) throw error;
      
      toast.success("Oferta rechazada");
      setReviewingOffer(null);
      setRejectionReason("");
      refetch();
    } catch (error) {
      toast.error("Error al rechazar la oferta");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter offers based on active tab
  const filteredOffers = offers.filter(offer => {
    if (activeTab === "pending") {
      return offer.approval_status === "PENDING_APPROVAL";
    }
    if (activeTab === "backlog") {
      // Show approved/active offers that have no ad mappings
      return offer.approval_status === "APPROVED" && 
             offer.status === "ACTIVE" && 
             (offer._count?.ads || 0) === 0;
    }
    return true;
  });

  const columns: Column<(typeof offers)[0]>[] = [
    {
      key: "name",
      header: "Oferta",
      cell: (offer) => {
        const TypeIcon = typeConfig[offer.offer_type]?.icon || Package;
        return (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              {offer.image_url ? (
                <Image
                  src={offer.image_url}
                  alt={offer.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <TypeIcon className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/admin/offers/${offer.id}`}
                className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors block truncate"
              >
                {offer.name}
              </Link>
              <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{offer.city || offer.zone || "Sin ubicación"}</span>
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
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {offer.tenant?.name || "Sin tenant"}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Estado",
      width: "75px",
      cell: (offer) => {
        const approval = approvalStatusConfig[offer.approval_status || 'APPROVED'];
        const status = statusConfig[offer.status];
        
        return (
          <div className="flex flex-col gap-1">
            {offer.approval_status && offer.approval_status !== 'APPROVED' && (
              <Badge variant={approval?.variant || "default"} dot>
                {approval?.label || offer.approval_status}
              </Badge>
            )}
            {(offer.approval_status === 'APPROVED' || !offer.approval_status) && (
              <Badge variant={status?.variant || "default"} dot>
                {status?.label || offer.status}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "price",
      header: "Precio",
      cell: (offer) => (
        <span className="text-[var(--text-secondary)]">
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
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]" title="Leads">
            <Users className="h-4 w-4" />
            <span>{offer._count?.leads || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]" title="Ads mapeados">
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
        <div className="flex items-center gap-2">
          {/* Quick action for pending approval */}
          {offer.approval_status === "PENDING_APPROVAL" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setReviewingOffer(offer);
              }}
            >
              Revisar
            </Button>
          )}
          
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
        </div>
      ),
    },
  ];

  const tabs = [
    { id: "all" as const, label: "Todas", count: total },
    { id: "pending" as const, label: "Pendientes", count: pendingCount, highlight: pendingCount > 0 },
    { id: "backlog" as const, label: "Sin campaña", count: backlogCount, highlight: backlogCount > 0 },
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

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-[var(--bg-tertiary)] rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                tab.highlight
                  ? "bg-[var(--warning-light)] text-[var(--warning-dark)]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        {/* Filters */}
        <div className="p-4 border-b border-[var(--border-primary)]">
          <div className="flex flex-col lg:flex-row gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, slug o ciudad..."
              className="flex-1 max-w-md"
            />

            <div className="flex items-center gap-3">
              {/* Tenant filter */}
              <CustomSelect
                value={tenantFilter}
                onChange={setTenantFilter}
                options={[{ value: "", label: "Todos los tenants" }, ...tenantOptions]}
                placeholder="Tenant"
                className="w-48"
              />

              {/* Status filters - only show for "all" tab */}
              {activeTab === "all" && (
                <div className="flex items-center gap-1">
                  {["", "ACTIVE", "DRAFT", "PAUSED"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        statusFilter === status
                          ? "bg-[var(--accent-primary-light)] text-[var(--accent-primary)] border border-[var(--accent-primary-muted)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      {status === ""
                        ? "Todos"
                        : statusConfig[status]?.label || status}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Responsive List */}
        <div className={isMobile ? "p-4" : ""}>
          <ResponsiveList
            data={activeTab === "all" ? offers : filteredOffers}
            columns={columns}
            keyExtractor={(o) => o.id}
            isLoading={isLoading}
            loadingCount={5}
            onItemClick={(offer) => router.push(`/admin/offers/${offer.id}`)}
            renderMobileItem={(offer) => {
              const TypeIcon = typeConfig[offer.offer_type]?.icon || Package;
              const approval = approvalStatusConfig[offer.approval_status || 'APPROVED'];
              const status = statusConfig[offer.status];
              
              return (
                <MobileCard
                  avatar={
                    offer.image_url ? (
                      <MobileCardAvatar src={offer.image_url} alt={offer.name} />
                    ) : (
                      <MobileCardAvatar variant="success" icon={TypeIcon} />
                    )
                  }
                  title={offer.name}
                  subtitle={`📍 ${offer.city || offer.zone || "Sin ubicación"}`}
                  badges={
                    <div className="flex gap-1.5">
                      {offer.approval_status && offer.approval_status !== 'APPROVED' && (
                        <Badge variant={approval?.variant || "default"} size="sm" dot>
                          {approval?.label || offer.approval_status}
                        </Badge>
                      )}
                      {(offer.approval_status === 'APPROVED' || !offer.approval_status) && (
                        <Badge variant={status?.variant || "default"} size="sm" dot>
                          {status?.label || offer.status}
                        </Badge>
                      )}
                    </div>
                  }
                  stats={[
                    { icon: Users, value: offer._count?.leads || 0, label: "Leads" },
                    { icon: Megaphone, value: offer._count?.ads || 0, label: "Ads" },
                  ]}
                  metadata={offer.price_from ? formatCurrency(offer.price_from, offer.currency) : undefined}
                  rightContent={
                    <ResponsiveActionMenu
                      title={offer.name}
                      items={[
                        { label: "Ver detalles", icon: Eye, onClick: () => router.push(`/admin/offers/${offer.id}`) },
                        { label: "Editar", icon: Edit, onClick: () => router.push(`/admin/offers/${offer.id}/edit`) },
                        { divider: true, label: "" },
                        ...(offer.approval_status === "PENDING_APPROVAL"
                          ? [{ label: "Revisar", icon: CheckCircle, onClick: () => setReviewingOffer(offer) }]
                          : []),
                        ...(offer.status === "ACTIVE"
                          ? [{ label: "Pausar", icon: Pause, onClick: () => handleStatusChange(offer.id, "PAUSED") }]
                          : []),
                        ...(offer.status === "PAUSED" || offer.status === "DRAFT"
                          ? [{ label: "Activar", icon: Play, onClick: () => handleStatusChange(offer.id, "ACTIVE") }]
                          : []),
                        { label: "Archivar", icon: Archive, onClick: () => handleStatusChange(offer.id, "ARCHIVED") },
                        { divider: true, label: "" },
                        { label: "Eliminar", icon: Trash2, onClick: () => setDeleteId(offer.id), danger: true },
                      ].filter((item): item is NonNullable<typeof item> => item !== null)}
                    />
                  }
                  showChevron={false}
                  onPress={() => router.push(`/admin/offers/${offer.id}`)}
                />
              );
            }}
            emptyState={
              activeTab === "pending" ? (
                <EmptyState
                  icon={<CheckCircle />}
                  title="Sin ofertas pendientes"
                  description="No hay ofertas esperando aprobación."
                  size="sm"
                />
              ) : activeTab === "backlog" ? (
                <EmptyState
                  icon={<Megaphone />}
                  title="Todo al día"
                  description="Todas las ofertas tienen campañas mapeadas."
                  size="sm"
                />
              ) : (
                <NoOffersEmptyState
                  action={{
                    label: "Crear primera oferta",
                    onClick: () => router.push("/admin/offers/new"),
                  }}
                />
              )
            }
          />
        </div>

        {/* Pagination */}
        {total > pageSize && activeTab === "all" && (
          <div className="p-4 border-t border-[var(--border-primary)]">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / pageSize)}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </Card>

      {/* FAB for mobile */}
      <FloatingActionButton
        icon={<Plus className="h-6 w-6" />}
        onClick={() => router.push("/admin/offers/new")}
        label="Nueva"
      />

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

      {/* Review Modal */}
      <Modal
        isOpen={!!reviewingOffer}
        onClose={() => {
          setReviewingOffer(null);
          setRejectionReason("");
        }}
        title="Revisar oferta"
        size="md"
      >
        {reviewingOffer && (
          <div className="space-y-4">
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
              <h3 className="font-semibold text-[var(--text-primary)] text-lg">{reviewingOffer.name}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {reviewingOffer.tenant?.name} • {reviewingOffer.city || "Sin ubicación"}
              </p>
              {reviewingOffer.price_from && (
                <p className="text-[var(--accent-primary)] mt-2">
                  {formatCurrency(reviewingOffer.price_from, reviewingOffer.currency)}
                  {reviewingOffer.price_to && reviewingOffer.price_to !== reviewingOffer.price_from && 
                    ` - ${formatCurrency(reviewingOffer.price_to, reviewingOffer.currency)}`
                  }
                </p>
              )}
              {reviewingOffer.submitted_at && (
                <p className="text-xs text-[var(--text-tertiary)] mt-2">
                  Enviada {formatRelativeTime(reviewingOffer.submitted_at)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Motivo de rechazo (opcional para aprobar)
              </label>
              <TextArea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Indicá qué debe corregir el tenant..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-primary)]">
              <Button
                variant="danger"
                onClick={handleReject}
                isLoading={isProcessing}
                disabled={!rejectionReason.trim()}
                leftIcon={<XCircle className="h-4 w-4" />}
              >
                Rechazar
              </Button>
              <Button
                variant="primary"
                onClick={handleApprove}
                isLoading={isProcessing}
                leftIcon={<CheckCircle className="h-4 w-4" />}
              >
                Aprobar
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push(`/admin/offers/${reviewingOffer.id}`)}
              >
                Ver detalles
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}

