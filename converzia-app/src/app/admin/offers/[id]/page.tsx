"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Users,
  Layers,
  Megaphone,
  Edit,
  Plus,
  MapPin,
  DollarSign,
  Building2,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { DataTable, Column } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useOffer, useOfferMutations } from "@/lib/hooks/use-offers";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { OfferVariant, Unit } from "@/types";

// Status config
const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "default" }> = {
  ACTIVE: { label: "Activo", variant: "success" },
  DRAFT: { label: "Borrador", variant: "secondary" },
  PAUSED: { label: "Pausado", variant: "warning" },
  ARCHIVED: { label: "Archivado", variant: "default" },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default function OfferDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { offer, variants, units, adMappings, isLoading, error, refetch } = useOffer(id);
  const { updateOffer, createVariant, deleteVariant, createUnit, deleteUnit, isLoading: isMutating } = useOfferMutations();

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  const [deleteUnitId, setDeleteUnitId] = useState<string | null>(null);

  // Form states
  const [newVariant, setNewVariant] = useState({ name: "", bedrooms: "", bathrooms: "", area_m2: "", price_from: "" });
  const [newUnit, setNewUnit] = useState({ unit_number: "", variant_id: "", floor: "", price: "" });

  const handleStatusChange = async (newStatus: string) => {
    if (!offer) return;
    try {
      await updateOffer(offer.id, { status: newStatus as any });
      toast.success(`Oferta ${statusConfig[newStatus]?.label || newStatus}`);
      refetch();
    } catch (error) {
      toast.error("Error al actualizar la oferta");
    }
  };

  const handleCreateVariant = async () => {
    if (!offer || !newVariant.name) return;
    try {
      await createVariant({
        offer_id: offer.id,
        name: newVariant.name,
        bedrooms: newVariant.bedrooms ? parseInt(newVariant.bedrooms) : null,
        bathrooms: newVariant.bathrooms ? parseInt(newVariant.bathrooms) : null,
        area_m2: newVariant.area_m2 ? parseFloat(newVariant.area_m2) : null,
        price_from: newVariant.price_from ? parseFloat(newVariant.price_from) : null,
      });
      toast.success("Variante creada");
      setShowVariantModal(false);
      setNewVariant({ name: "", bedrooms: "", bathrooms: "", area_m2: "", price_from: "" });
      refetch();
    } catch (error) {
      toast.error("Error al crear variante");
    }
  };

  const handleDeleteVariant = async () => {
    if (!deleteVariantId) return;
    try {
      await deleteVariant(deleteVariantId);
      toast.success("Variante eliminada");
      setDeleteVariantId(null);
      refetch();
    } catch (error) {
      toast.error("Error al eliminar variante");
    }
  };

  const handleCreateUnit = async () => {
    if (!offer || !newUnit.unit_number || !newUnit.variant_id) return;
    try {
      await createUnit({
        offer_id: offer.id,
        variant_id: newUnit.variant_id,
        unit_number: newUnit.unit_number,
        floor: newUnit.floor ? parseInt(newUnit.floor) : null,
        price: newUnit.price ? parseFloat(newUnit.price) : null,
      });
      toast.success("Unidad creada");
      setShowUnitModal(false);
      setNewUnit({ unit_number: "", variant_id: "", floor: "", price: "" });
      refetch();
    } catch (error) {
      toast.error("Error al crear unidad");
    }
  };

  const handleDeleteUnit = async () => {
    if (!deleteUnitId) return;
    try {
      await deleteUnit(deleteUnitId);
      toast.success("Unidad eliminada");
      setDeleteUnitId(null);
      refetch();
    } catch (error) {
      toast.error("Error al eliminar unidad");
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (error || !offer) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error">
          {error || "No se pudo cargar la oferta"}
        </Alert>
      </PageContainer>
    );
  }

  const statusCfg = statusConfig[offer.status];

  // Variant columns
  const variantColumns: Column<OfferVariant>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (v) => <span className="font-medium text-white">{v.name}</span>,
    },
    {
      key: "specs",
      header: "Especificaciones",
      cell: (v) => (
        <span className="text-slate-400">
          {v.bedrooms !== null && `${v.bedrooms} amb`}
          {v.area_m2 && ` • ${v.area_m2}m²`}
        </span>
      ),
    },
    {
      key: "price",
      header: "Precio desde",
      cell: (v) => (
        <span className="text-slate-300">
          {v.price_from ? formatCurrency(v.price_from, v.currency) : "-"}
        </span>
      ),
    },
    {
      key: "units",
      header: "Unidades",
      cell: (v) => {
        const variantUnits = units.filter((u) => u.variant_id === v.id);
        const available = variantUnits.filter((u) => u.is_available).length;
        return (
          <span className="text-slate-400">
            {available}/{variantUnits.length} disponibles
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      cell: (v) => (
        <ActionDropdown
          items={[
            { label: "Editar", onClick: () => {} },
            { divider: true, label: "" },
            { label: "Eliminar", onClick: () => setDeleteVariantId(v.id), danger: true },
          ]}
        />
      ),
    },
  ];

  // Unit columns
  const unitColumns: Column<Unit>[] = [
    {
      key: "unit",
      header: "Unidad",
      cell: (u) => <span className="font-medium text-white">{u.unit_number}</span>,
    },
    {
      key: "variant",
      header: "Variante",
      cell: (u) => {
        const variant = variants.find((v) => v.id === u.variant_id);
        return <span className="text-slate-400">{variant?.name || "-"}</span>;
      },
    },
    {
      key: "floor",
      header: "Piso",
      cell: (u) => <span className="text-slate-400">{u.floor ?? "-"}</span>,
    },
    {
      key: "price",
      header: "Precio",
      cell: (u) => (
        <span className="text-slate-300">
          {u.price ? formatCurrency(u.price, u.currency) : "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (u) => (
        <Badge variant={u.is_available ? "success" : "secondary"}>
          {u.is_available ? "Disponible" : "No disponible"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      cell: (u) => (
        <ActionDropdown
          items={[
            { label: "Editar", onClick: () => {} },
            {
              label: u.is_available ? "Marcar no disponible" : "Marcar disponible",
              onClick: () => {},
            },
            { divider: true, label: "" },
            { label: "Eliminar", onClick: () => setDeleteUnitId(u.id), danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={offer.name}
        description={`/${offer.slug} • ${offer.city || offer.zone || "Sin ubicación"}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Ofertas", href: "/admin/offers" },
          { label: offer.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={statusCfg?.variant || "default"} dot>
              {statusCfg?.label || offer.status}
            </Badge>
            <Button
              variant="secondary"
              leftIcon={<Edit className="h-4 w-4" />}
              onClick={() => router.push(`/admin/offers/${offer.id}/edit`)}
            >
              Editar
            </Button>
            <ActionDropdown
              items={[
                offer.status !== "ACTIVE"
                  ? { label: "Activar", onClick: () => handleStatusChange("ACTIVE") }
                  : { label: "Pausar", onClick: () => handleStatusChange("PAUSED") },
                { label: "Archivar", onClick: () => handleStatusChange("ARCHIVED") },
              ]}
            />
          </div>
        }
      />

      {/* Stats */}
      <StatsGrid columns={4} className="mb-6">
        <StatCard
          title="Variantes"
          value={offer._count?.variants || 0}
          icon={<Layers />}
          iconColor="from-blue-500 to-cyan-500"
        />
        <StatCard
          title="Unidades"
          value={offer._count?.units || 0}
          icon={<Package />}
          iconColor="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Leads"
          value={offer._count?.leads || 0}
          icon={<Users />}
          iconColor="from-purple-500 to-pink-500"
        />
        <StatCard
          title="Ads Mapeados"
          value={offer._count?.ads || 0}
          icon={<Megaphone />}
          iconColor="from-amber-500 to-orange-500"
        />
      </StatsGrid>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabTrigger value="info">Información</TabTrigger>
          <TabTrigger value="variants" count={variants.length}>Variantes</TabTrigger>
          <TabTrigger value="units" count={units.length}>Unidades</TabTrigger>
          <TabTrigger value="ads" count={adMappings.length}>Ads</TabTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Información general</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Tenant" value={
                  <Link href={`/admin/tenants/${offer.tenant?.id}`} className="text-primary-400 hover:underline">
                    {offer.tenant?.name}
                  </Link>
                } />
                <InfoRow label="Tipo" value={offer.offer_type} />
                <InfoRow label="Prioridad" value={offer.priority} />
                <InfoRow label="Creado" value={formatDate(offer.created_at)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ubicación y precios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow icon={<MapPin />} label="Dirección" value={offer.address || "-"} />
                <InfoRow label="Ciudad" value={offer.city || "-"} />
                <InfoRow label="Zona" value={offer.zone || "-"} />
                <InfoRow
                  icon={<DollarSign />}
                  label="Precio"
                  value={
                    offer.price_from
                      ? offer.price_to
                        ? `${formatCurrency(offer.price_from, offer.currency)} - ${formatCurrency(offer.price_to, offer.currency)}`
                        : formatCurrency(offer.price_from, offer.currency)
                      : "-"
                  }
                />
              </CardContent>
            </Card>

            {offer.description && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Descripción</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 whitespace-pre-wrap">{offer.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabContent>

        {/* Variants Tab */}
        <TabContent value="variants">
          <Card>
            <CardHeader action={
              <Button size="sm" onClick={() => setShowVariantModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Nueva Variante
              </Button>
            }>
              <CardTitle>Variantes de tipología</CardTitle>
            </CardHeader>
            <DataTable
              data={variants}
              columns={variantColumns}
              keyExtractor={(v) => v.id}
              emptyState={
                <div className="py-8 text-center text-slate-500">
                  No hay variantes. <button onClick={() => setShowVariantModal(true)} className="text-primary-400 hover:underline">Crear primera variante</button>
                </div>
              }
            />
          </Card>
        </TabContent>

        {/* Units Tab */}
        <TabContent value="units">
          <Card>
            <CardHeader action={
              <Button size="sm" onClick={() => setShowUnitModal(true)} leftIcon={<Plus className="h-4 w-4" />} disabled={variants.length === 0}>
                Nueva Unidad
              </Button>
            }>
              <CardTitle>Unidades disponibles</CardTitle>
            </CardHeader>
            <DataTable
              data={units}
              columns={unitColumns}
              keyExtractor={(u) => u.id}
              emptyState={
                <div className="py-8 text-center text-slate-500">
                  {variants.length === 0 
                    ? "Primero debés crear variantes para agregar unidades."
                    : <span>No hay unidades. <button onClick={() => setShowUnitModal(true)} className="text-primary-400 hover:underline">Crear primera unidad</button></span>
                  }
                </div>
              }
            />
          </Card>
        </TabContent>

        {/* Ads Tab */}
        <TabContent value="ads">
          <Card>
            <CardHeader action={
              <Link href="/admin/ads-mapping">
                <Button size="sm" variant="secondary">Ir a mapeo de Ads</Button>
              </Link>
            }>
              <CardTitle>Ads mapeados a esta oferta</CardTitle>
            </CardHeader>
            <CardContent>
              {adMappings.length > 0 ? (
                <div className="space-y-3">
                  {adMappings.map((ad) => (
                    <div key={ad.id} className="flex items-center justify-between p-3 rounded-lg bg-card-border/50">
                      <div>
                        <p className="font-medium text-white">{ad.ad_name || ad.ad_id}</p>
                        <p className="text-sm text-slate-500">
                          {ad.campaign_name && `Campaña: ${ad.campaign_name}`}
                          {ad.form_id && ` • Form: ${ad.form_id}`}
                        </p>
                      </div>
                      <Badge variant={ad.is_active ? "success" : "secondary"}>
                        {ad.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-slate-500">
                  No hay ads mapeados a esta oferta. Los ads se mapean desde la sección de <Link href="/admin/ads-mapping" className="text-primary-400 hover:underline">Mapeo de Ads</Link>.
                </p>
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>

      {/* Create Variant Modal */}
      <Modal
        isOpen={showVariantModal}
        onClose={() => setShowVariantModal(false)}
        title="Nueva Variante"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowVariantModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateVariant} isLoading={isMutating}>Crear</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Ej: 2 Ambientes"
            value={newVariant.name}
            onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ambientes"
              type="number"
              min={0}
              value={newVariant.bedrooms}
              onChange={(e) => setNewVariant({ ...newVariant, bedrooms: e.target.value })}
            />
            <Input
              label="Baños"
              type="number"
              min={0}
              value={newVariant.bathrooms}
              onChange={(e) => setNewVariant({ ...newVariant, bathrooms: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Superficie (m²)"
              type="number"
              min={0}
              value={newVariant.area_m2}
              onChange={(e) => setNewVariant({ ...newVariant, area_m2: e.target.value })}
            />
            <Input
              label="Precio desde"
              type="number"
              min={0}
              value={newVariant.price_from}
              onChange={(e) => setNewVariant({ ...newVariant, price_from: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Create Unit Modal */}
      <Modal
        isOpen={showUnitModal}
        onClose={() => setShowUnitModal(false)}
        title="Nueva Unidad"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUnitModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateUnit} isLoading={isMutating}>Crear</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Número de unidad"
            placeholder="Ej: 101"
            value={newUnit.unit_number}
            onChange={(e) => setNewUnit({ ...newUnit, unit_number: e.target.value })}
            required
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Variante *</label>
            <select
              value={newUnit.variant_id}
              onChange={(e) => setNewUnit({ ...newUnit, variant_id: e.target.value })}
              className="w-full h-10 px-4 rounded-lg border border-card-border bg-card text-white"
            >
              <option value="">Seleccionar variante</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Piso"
              type="number"
              value={newUnit.floor}
              onChange={(e) => setNewUnit({ ...newUnit, floor: e.target.value })}
            />
            <Input
              label="Precio"
              type="number"
              min={0}
              value={newUnit.price}
              onChange={(e) => setNewUnit({ ...newUnit, price: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Variant Modal */}
      <ConfirmModal
        isOpen={!!deleteVariantId}
        onClose={() => setDeleteVariantId(null)}
        onConfirm={handleDeleteVariant}
        title="Eliminar variante"
        description="¿Estás seguro? Se eliminarán también todas las unidades asociadas."
        confirmText="Eliminar"
        variant="danger"
        isLoading={isMutating}
      />

      {/* Delete Unit Modal */}
      <ConfirmModal
        isOpen={!!deleteUnitId}
        onClose={() => setDeleteUnitId(null)}
        onConfirm={handleDeleteUnit}
        title="Eliminar unidad"
        description="¿Estás seguro de que querés eliminar esta unidad?"
        confirmText="Eliminar"
        variant="danger"
        isLoading={isMutating}
      />
    </PageContainer>
  );
}

// Helper component
function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3 text-slate-400">
        {icon && <span className="h-5 w-5">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="text-white">{value}</div>
    </div>
  );
}

