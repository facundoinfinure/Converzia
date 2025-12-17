"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  AlertTriangle,
  Link as LinkIcon,
  Users,
  Clock,
  RefreshCw,
  Check,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { ActionDropdown, SelectDropdown } from "@/components/ui/Dropdown";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useUnmappedAds, useAdMappings, useAdMappingMutations, useOffersForMapping } from "@/lib/hooks/use-ads";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import type { UnmappedAd } from "@/types";

export default function AdsMappingPage() {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [mappingAd, setMappingAd] = useState<UnmappedAd | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { unmappedAds, total: unmappedTotal, isLoading: loadingUnmapped, refetch: refetchUnmapped } = useUnmappedAds();
  const { mappings, total: mappingsTotal, isLoading: loadingMappings, refetch: refetchMappings } = useAdMappings({
    search,
    page,
    pageSize: 20,
  });
  const { createMapping, deleteMapping, reprocessLeads, isLoading: isMutating } = useAdMappingMutations();
  const { tenantsWithOffers, isLoading: loadingOffers } = useOffersForMapping();

  // Get offers for selected tenant
  const selectedTenant = tenantsWithOffers.find((t) => t.id === selectedTenantId);
  const offerOptions = selectedTenant?.offers.map((o) => ({ value: o.id, label: o.name, description: selectedTenant.name })) || [];

  const handleCreateMapping = async () => {
    if (!mappingAd || !selectedTenantId || !selectedOfferId) return;

    try {
      await createMapping({
        tenant_id: selectedTenantId,
        offer_id: selectedOfferId,
        ad_id: mappingAd.ad_id,
        campaign_id: mappingAd.campaign_id || undefined,
        form_id: mappingAd.form_id || undefined,
      });
      toast.success(`Ad mapeado correctamente. ${mappingAd.lead_count} leads serán procesados.`);
      setMappingAd(null);
      setSelectedTenantId("");
      setSelectedOfferId("");
      refetchUnmapped();
      refetchMappings();
    } catch (error) {
      toast.error("Error al crear el mapeo");
    }
  };

  const handleDeleteMapping = async () => {
    if (!deleteId) return;
    try {
      await deleteMapping(deleteId);
      toast.success("Mapeo eliminado");
      setDeleteId(null);
      refetchMappings();
    } catch (error) {
      toast.error("Error al eliminar el mapeo");
    }
  };

  const handleReprocess = async (adId: string) => {
    try {
      await reprocessLeads(adId);
      toast.success("Leads reprocesados correctamente");
    } catch (error) {
      toast.error("Error al reprocesar leads");
    }
  };

  // Unmapped ads columns
  const unmappedColumns: Column<UnmappedAd>[] = [
    {
      key: "ad",
      header: "Ad ID",
      cell: (ad) => (
        <div>
          <span className="font-medium text-white font-mono text-sm">{ad.ad_id}</span>
          {ad.campaign_id && (
            <p className="text-xs text-slate-500 mt-0.5">
              Campaign: {ad.campaign_id}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "leads",
      header: "Leads",
      cell: (ad) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <span className="font-medium text-amber-400">{ad.lead_count}</span>
          <span className="text-slate-500">esperando</span>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Período",
      cell: (ad) => (
        <div className="text-sm text-slate-400">
          <span>{formatRelativeTime(ad.first_lead_at)}</span>
          <span className="mx-1">→</span>
          <span>{formatRelativeTime(ad.last_lead_at)}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "120px",
      cell: (ad) => (
        <Button
          size="sm"
          onClick={() => setMappingAd(ad)}
          leftIcon={<LinkIcon className="h-4 w-4" />}
        >
          Mapear
        </Button>
      ),
    },
  ];

  // Mappings columns
  const mappingsColumns: Column<(typeof mappings)[0]>[] = [
    {
      key: "ad",
      header: "Ad",
      cell: (m) => (
        <div>
          <span className="font-medium text-white">{m.ad_name || m.ad_id}</span>
          {m.campaign_name && (
            <p className="text-xs text-slate-500 mt-0.5">{m.campaign_name}</p>
          )}
        </div>
      ),
    },
    {
      key: "mapping",
      header: "Mapeo",
      cell: (m) => (
        <div>
          <span className="text-primary-400">{m.offer?.name}</span>
          <p className="text-xs text-slate-500 mt-0.5">{m.tenant?.name}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (m) => (
        <Badge variant={m.is_active ? "success" : "secondary"} dot>
          {m.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Creado",
      cell: (m) => (
        <span className="text-slate-400 text-sm">{formatDate(m.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      cell: (m) => (
        <ActionDropdown
          items={[
            {
              label: "Reprocesar leads",
              onClick: () => handleReprocess(m.ad_id),
              icon: <RefreshCw className="h-4 w-4" />,
            },
            m.is_active
              ? { label: "Desactivar", onClick: () => {} }
              : { label: "Activar", onClick: () => {} },
            { divider: true, label: "" },
            {
              label: "Eliminar",
              onClick: () => setDeleteId(m.id),
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
        title="Mapeo de Ads"
        description="Conectá los ads de Meta con ofertas para procesar leads"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Mapeo de Ads" },
        ]}
      />

      {/* Alert if unmapped */}
      {unmappedTotal > 0 && (
        <Alert variant="warning" className="mb-6" title={`${unmappedTotal} Ads sin mapear`}>
          Hay leads esperando ser procesados. Mapeá los ads a ofertas para iniciar la calificación automática.
        </Alert>
      )}

      <Tabs defaultValue="unmapped">
        <TabsList>
          <TabTrigger value="unmapped" count={unmappedTotal}>
            Sin mapear
          </TabTrigger>
          <TabTrigger value="mappings" count={mappingsTotal}>
            Mapeos activos
          </TabTrigger>
        </TabsList>

        {/* Unmapped Ads */}
        <TabContent value="unmapped">
          <Card>
            <CardHeader>
              <CardTitle>Ads sin mapear</CardTitle>
            </CardHeader>
            <DataTable
              data={unmappedAds}
              columns={unmappedColumns}
              keyExtractor={(a) => a.ad_id}
              isLoading={loadingUnmapped}
              emptyState={
                <EmptyState
                  icon={<Check />}
                  title="¡Todo mapeado!"
                  description="No hay ads pendientes de mapear. Los nuevos ads aparecerán aquí automáticamente."
                  size="sm"
                />
              }
            />
          </Card>
        </TabContent>

        {/* Active Mappings */}
        <TabContent value="mappings">
          <Card>
            <div className="p-4 border-b border-card-border">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por ad ID, nombre o campaña..."
                className="max-w-md"
              />
            </div>
            <DataTable
              data={mappings}
              columns={mappingsColumns}
              keyExtractor={(m) => m.id}
              isLoading={loadingMappings}
              emptyState={
                <EmptyState
                  icon={<Megaphone />}
                  title="Sin mapeos"
                  description="No hay mapeos configurados. Mapea ads desde la pestaña 'Sin mapear'."
                  size="sm"
                />
              }
            />
            {mappingsTotal > 20 && (
              <div className="p-4 border-t border-card-border">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(mappingsTotal / 20)}
                  totalItems={mappingsTotal}
                  pageSize={20}
                  onPageChange={setPage}
                />
              </div>
            )}
          </Card>
        </TabContent>
      </Tabs>

      {/* Create Mapping Modal */}
      <Modal
        isOpen={!!mappingAd}
        onClose={() => {
          setMappingAd(null);
          setSelectedTenantId("");
          setSelectedOfferId("");
        }}
        title="Mapear Ad a Oferta"
        description="Seleccioná el tenant y la oferta para este ad"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMappingAd(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateMapping}
              isLoading={isMutating}
              disabled={!selectedTenantId || !selectedOfferId}
            >
              Crear mapeo
            </Button>
          </>
        }
      >
        {mappingAd && (
          <div className="space-y-6">
            {/* Ad Info */}
            <div className="p-4 rounded-lg bg-card-border/50">
              <div className="flex items-center gap-3 mb-2">
                <Megaphone className="h-5 w-5 text-amber-400" />
                <span className="font-medium text-white">Ad ID: {mappingAd.ad_id}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {mappingAd.lead_count} leads pendientes
                </span>
                {mappingAd.campaign_id && (
                  <span>Campaign: {mappingAd.campaign_id}</span>
                )}
              </div>
            </div>

            {/* Tenant Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tenant *
              </label>
              <SelectDropdown
                value={selectedTenantId}
                onChange={(val) => {
                  setSelectedTenantId(val);
                  setSelectedOfferId("");
                }}
                options={tenantsWithOffers.map((t) => ({
                  value: t.id,
                  label: t.name,
                  description: `${t.offers.length} ofertas`,
                }))}
                placeholder="Seleccionar tenant"
                disabled={loadingOffers}
              />
            </div>

            {/* Offer Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Oferta *
              </label>
              <SelectDropdown
                value={selectedOfferId}
                onChange={setSelectedOfferId}
                options={offerOptions}
                placeholder={selectedTenantId ? "Seleccionar oferta" : "Primero seleccioná un tenant"}
                disabled={!selectedTenantId}
              />
            </div>

            {selectedOfferId && (
              <Alert variant="info">
                Al crear este mapeo, los {mappingAd.lead_count} leads pendientes serán procesados automáticamente.
              </Alert>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Mapping Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteMapping}
        title="Eliminar mapeo"
        description="¿Estás seguro? Los futuros leads de este ad quedarán sin procesar."
        confirmText="Eliminar"
        variant="danger"
        isLoading={isMutating}
      />
    </PageContainer>
  );
}

