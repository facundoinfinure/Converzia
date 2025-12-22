"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Megaphone,
  AlertTriangle,
  Link as LinkIcon,
  Users,
  Clock,
  RefreshCw,
  Check,
  Edit,
  Package,
  MapPin,
  Plus,
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
import { Input } from "@/components/ui/Input";
import { useUnmappedAds, useAdMappings, useAdMappingMutations, useOffersForMapping } from "@/lib/hooks/use-ads";
import { formatRelativeTime, formatDate, formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { UnmappedAd } from "@/types";

interface OfferWithoutAd {
  id: string;
  name: string;
  slug: string;
  city?: string;
  zone?: string;
  price_from?: number;
  price_to?: number;
  currency?: string;
  created_at: string;
  tenant: { id: string; name: string };
}

export default function AdsMappingPage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [mappingAd, setMappingAd] = useState<UnmappedAd | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingMapping, setEditingMapping] = useState<typeof mappings[0] | null>(null);

  // State for offers without ads
  const [offersWithoutAds, setOffersWithoutAds] = useState<OfferWithoutAd[]>([]);
  const [loadingOffersWithoutAds, setLoadingOffersWithoutAds] = useState(true);

  // State for manual mapping modal
  const [manualMappingOffer, setManualMappingOffer] = useState<OfferWithoutAd | null>(null);
  const [manualAdId, setManualAdId] = useState("");
  const [manualCampaignId, setManualCampaignId] = useState("");

  const { unmappedAds, total: unmappedTotal, isLoading: loadingUnmapped, error: unmappedError, refetch: refetchUnmapped } = useUnmappedAds();
  const { mappings, total: mappingsTotal, isLoading: loadingMappings, error: mappingsError, refetch: refetchMappings } = useAdMappings({
    search,
    page,
    pageSize: 20,
  });
  const { createMapping, updateMapping, deleteMapping, reprocessLeads, isLoading: isMutating } = useAdMappingMutations();
  const { tenantsWithOffers, isLoading: loadingOffers } = useOffersForMapping();

  // Get offers for selected tenant
  const selectedTenant = tenantsWithOffers.find((t) => t.id === selectedTenantId);
  const offerOptions = selectedTenant?.offers.map((o) => ({ value: o.id, label: o.name, description: selectedTenant.name })) || [];

  // Fetch offers without ads
  const fetchOffersWithoutAds = useCallback(async () => {
    setLoadingOffersWithoutAds(true);
    try {
      // Get all active/approved offers
      const { data: offers, error: offersError } = await supabase
        .from("offers")
        .select("id, name, slug, city, zone, price_from, price_to, currency, created_at, tenant:tenants(id, name)")
        .eq("status", "ACTIVE")
        .eq("approval_status", "APPROVED")
        .order("created_at", { ascending: false });

      if (offersError) throw offersError;

      // Get all offer_ids that have mappings
      const { data: mappedOffers } = await supabase
        .from("ad_offer_map")
        .select("offer_id");

      const mappedOfferIds = new Set((mappedOffers || []).map((m: any) => m.offer_id));

      // Filter offers that don't have any mappings
      const unmappedOffers = (offers || [])
        .filter((offer: any) => !mappedOfferIds.has(offer.id))
        .map((offer: any) => ({
          ...offer,
          tenant: Array.isArray(offer.tenant) ? offer.tenant[0] : offer.tenant,
        }));

      setOffersWithoutAds(unmappedOffers);
    } catch (err) {
      console.error("Error fetching offers without ads:", err);
    } finally {
      setLoadingOffersWithoutAds(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOffersWithoutAds();
  }, [fetchOffersWithoutAds]);

  // Handle manual mapping creation
  const handleManualMapping = async () => {
    if (!manualMappingOffer || !manualAdId.trim()) return;

    try {
      await createMapping({
        tenant_id: manualMappingOffer.tenant.id,
        offer_id: manualMappingOffer.id,
        ad_id: manualAdId.trim(),
        campaign_id: manualCampaignId.trim() || undefined,
      });
      toast.success("Mapeo creado correctamente");
      setManualMappingOffer(null);
      setManualAdId("");
      setManualCampaignId("");
      fetchOffersWithoutAds();
      refetchMappings();
    } catch (error) {
      toast.error("Error al crear el mapeo");
    }
  };

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

  const handleEditMapping = (mapping: typeof mappings[0]) => {
    setEditingMapping(mapping);
    setSelectedTenantId(mapping.tenant_id);
    // Find the tenant and set the offer
    const tenant = tenantsWithOffers.find((t) => t.id === mapping.tenant_id);
    if (tenant) {
      setSelectedOfferId(mapping.offer_id);
    }
  };

  const handleUpdateMapping = async () => {
    if (!editingMapping || !selectedTenantId || !selectedOfferId) return;

    try {
      await updateMapping(editingMapping.id, {
        tenant_id: selectedTenantId,
        offer_id: selectedOfferId,
      });
      toast.success("Mapeo actualizado correctamente");
      setEditingMapping(null);
      setSelectedTenantId("");
      setSelectedOfferId("");
      refetchMappings();
    } catch (error) {
      toast.error("Error al actualizar el mapeo");
    }
  };

  // Unmapped ads columns
  const unmappedColumns: Column<UnmappedAd>[] = [
    {
      key: "ad",
      header: "Ad ID",
      cell: (ad) => (
        <div>
          <span className="font-medium text-[var(--text-primary)] font-mono text-sm">{ad.ad_id}</span>
          {ad.campaign_id && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
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
          <Users className="h-4 w-4 text-[var(--text-tertiary)]" />
          <span className="font-medium text-amber-400">{ad.lead_count}</span>
          <span className="text-[var(--text-tertiary)]">esperando</span>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Período",
      cell: (ad) => (
        <div className="text-sm text-[var(--text-tertiary)]">
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

  // Offers without ads columns
  const offersWithoutAdsColumns: Column<OfferWithoutAd>[] = [
    {
      key: "name",
      header: "Oferta",
      cell: (offer) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-[var(--text-primary)]" />
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/offers/${offer.id}`}
              className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors block truncate"
            >
              {offer.name}
            </Link>
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{offer.city || offer.zone || "Sin ubicación"}</span>
            </div>
          </div>
        </div>
      ),
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
      key: "created",
      header: "Creada",
      cell: (offer) => (
        <span className="text-[var(--text-tertiary)] text-sm">{formatRelativeTime(offer.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "140px",
      cell: (offer) => (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setManualMappingOffer(offer);
          }}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Crear mapeo
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
          <span className="font-medium text-[var(--text-primary)]">{m.ad_name || m.ad_id}</span>
          {m.campaign_name && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{m.campaign_name}</p>
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
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{m.tenant?.name}</p>
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
        <span className="text-[var(--text-tertiary)] text-sm">{formatDate(m.created_at)}</span>
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
              label: "Editar",
              onClick: () => handleEditMapping(m),
              icon: <Edit className="h-4 w-4" />,
            },
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

      {(unmappedError || mappingsError) && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {unmappedError || mappingsError}
        </div>
      )}

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
          <TabTrigger value="offers-pending" count={offersWithoutAds.length}>
            Ofertas sin campaña
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

        {/* Offers without Ads */}
        <TabContent value="offers-pending">
          <Card>
            <CardHeader>
              <CardTitle>Ofertas sin campaña asociada</CardTitle>
            </CardHeader>
            <DataTable
              data={offersWithoutAds}
              columns={offersWithoutAdsColumns}
              keyExtractor={(o) => o.id}
              isLoading={loadingOffersWithoutAds}
              onRowClick={(offer) => router.push(`/admin/offers/${offer.id}`)}
              emptyState={
                <EmptyState
                  icon={<Check />}
                  title="¡Todo listo!"
                  description="Todas las ofertas activas tienen al menos un ad asociado."
                  size="sm"
                />
              }
            />
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
                <span className="font-medium text-[var(--text-primary)]">Ad ID: {mappingAd.ad_id}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
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
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
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
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
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

      {/* Edit Mapping Modal */}
      {editingMapping && (
        <Modal
          isOpen={!!editingMapping}
          onClose={() => {
            setEditingMapping(null);
            setSelectedTenantId("");
            setSelectedOfferId("");
          }}
          title="Editar mapeo de Ad"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => {
                setEditingMapping(null);
                setSelectedTenantId("");
                setSelectedOfferId("");
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateMapping}
                isLoading={isMutating}
                disabled={!selectedTenantId || !selectedOfferId}
              >
                Actualizar
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Ad ID
              </label>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-tertiary)]">
                {editingMapping.ad_id}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
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

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
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
          </div>
        </Modal>
      )}

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

      {/* Manual Mapping Modal */}
      <Modal
        isOpen={!!manualMappingOffer}
        onClose={() => {
          setManualMappingOffer(null);
          setManualAdId("");
          setManualCampaignId("");
        }}
        title="Crear mapeo manual"
        description="Ingresá el Ad ID de Meta para asociar a esta oferta"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setManualMappingOffer(null);
              setManualAdId("");
              setManualCampaignId("");
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleManualMapping}
              isLoading={isMutating}
              disabled={!manualAdId.trim()}
            >
              Crear mapeo
            </Button>
          </>
        }
      >
        {manualMappingOffer && (
          <div className="space-y-6">
            {/* Offer Info */}
            <div className="p-4 rounded-lg bg-card-border/50">
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-5 w-5 text-emerald-400" />
                <span className="font-medium text-[var(--text-primary)]">{manualMappingOffer.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
                <span>{manualMappingOffer.tenant?.name}</span>
                {manualMappingOffer.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {manualMappingOffer.city}
                  </span>
                )}
              </div>
            </div>

            {/* Ad ID Input */}
            <Input
              label="Ad ID de Meta *"
              value={manualAdId}
              onChange={(e) => setManualAdId(e.target.value)}
              placeholder="Ej: 23851234567890123"
              hint="Podés encontrar el Ad ID en el Ads Manager de Meta"
              required
            />

            {/* Campaign ID Input (optional) */}
            <Input
              label="Campaign ID (opcional)"
              value={manualCampaignId}
              onChange={(e) => setManualCampaignId(e.target.value)}
              placeholder="Ej: 23851234567890456"
            />

            <Alert variant="info">
              Una vez creado el mapeo, los leads que lleguen con este Ad ID serán asignados automáticamente a esta oferta.
            </Alert>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}









