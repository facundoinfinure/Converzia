"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Users, MapPin, Plus, TrendingUp, Clock, CheckCircle, XCircle, Pause, Play } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { NoOffersEmptyState } from "@/components/ui/EmptyState";
import { usePortalOffers } from "@/lib/hooks/use-portal";
import { useAuth } from "@/lib/auth/context";
import { formatCurrency } from "@/lib/utils";

// Combined status config (status + approval_status)
const getStatusDisplay = (offer: any): { label: string; variant: "success" | "warning" | "secondary" | "default" | "danger" | "info"; icon?: React.ElementType } => {
  // Check approval status first
  const approvalStatus = offer.approval_status || 'APPROVED';
  
  if (approvalStatus === 'PENDING_APPROVAL') {
    return { label: "En revisión", variant: "info", icon: Clock };
  }
  if (approvalStatus === 'REJECTED') {
    return { label: "Rechazada", variant: "danger", icon: XCircle };
  }
  if (approvalStatus === 'DRAFT') {
    return { label: "Borrador", variant: "secondary" };
  }
  
  // If approved, check operational status
  switch (offer.status) {
    case 'ACTIVE':
      return { label: "Activa", variant: "success", icon: CheckCircle };
    case 'PAUSED':
      return { label: "Pausada", variant: "warning", icon: Pause };
    case 'ARCHIVED':
      return { label: "Archivada", variant: "default" };
    default:
      return { label: offer.status, variant: "secondary" };
  }
};

export default function PortalOffersPage() {
  const router = useRouter();
  const { offers, isLoading } = usePortalOffers();
  const { hasPermission } = useAuth();
  
  const canManageOffers = hasPermission?.('offers:manage') ?? false;

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Mis Proyectos" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mis Proyectos"
        description="Tus proyectos inmobiliarios y su rendimiento"
        actions={
          canManageOffers && (
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => router.push("/portal/offers/new")}
            >
              Nuevo proyecto
            </Button>
          )
        }
      />

      {offers.length === 0 ? (
        <NoOffersEmptyState 
          action={canManageOffers ? {
            label: "Crear primer proyecto",
            onClick: () => router.push("/portal/offers/new"),
          } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => {
            const statusDisplay = getStatusDisplay(offer);
            const StatusIcon = statusDisplay.icon;
            const leadCount = (offer as any).lead_count || 0;
            const deliveredCount = (offer as any).delivered_count || 0;

            return (
              <Link key={offer.id} href={`/portal/offers/${offer.id}`}>
                <Card className="overflow-hidden hover:border-primary-500/50 transition-colors cursor-pointer h-full">
                  {/* Image */}
                  <div className="h-36 bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center relative">
                    {offer.image_url ? (
                      <img
                        src={offer.image_url}
                        alt={offer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-slate-600" />
                    )}
                    {/* Status badge overlay */}
                    <div className="absolute top-3 right-3">
                      <Badge variant={statusDisplay.variant} dot>
                        {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
                        {statusDisplay.label}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="mb-3">
                      <h3 className="font-semibold text-white text-lg">{offer.name}</h3>
                      {(offer.city || offer.zone) && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {offer.city}{offer.zone && `, ${offer.zone}`}
                        </p>
                      )}
                    </div>

                    {/* Price */}
                    {offer.price_from && (
                      <p className="text-lg font-semibold text-primary-400 mb-3">
                        {offer.price_to && offer.price_to !== offer.price_from
                          ? `${formatCurrency(offer.price_from, offer.currency)} - ${formatCurrency(offer.price_to, offer.currency)}`
                          : `Desde ${formatCurrency(offer.price_from, offer.currency)}`}
                      </p>
                    )}

                    {/* Funnel Summary */}
                    <div className="flex items-center gap-4 text-sm pt-3 border-t border-card-border">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-slate-500" />
                        <span className="text-slate-400">{leadCount} leads</span>
                      </div>
                      {deliveredCount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          <span className="text-emerald-400">{deliveredCount} entregados</span>
                        </div>
                      )}
                    </div>

                    {/* Rejection reason if applicable */}
                    {offer.approval_status === 'REJECTED' && offer.rejection_reason && (
                      <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                        <strong>Motivo:</strong> {offer.rejection_reason}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
