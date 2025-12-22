"use client";

import { Package, Users, Layers, MapPin, Mail, ExternalLink } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { NoOffersEmptyState } from "@/components/ui/EmptyState";
import { usePortalOffers } from "@/lib/hooks/use-portal";
import { formatCurrency } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";

// Status config
const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "default" }> = {
  ACTIVE: { label: "Activo", variant: "success" },
  DRAFT: { label: "Borrador", variant: "secondary" },
  PAUSED: { label: "Pausado", variant: "warning" },
  ARCHIVED: { label: "Archivado", variant: "default" },
};

export default function PortalOffersPage() {
  const { offers, isLoading } = usePortalOffers();

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Mis Ofertas" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </PageContainer>
    );
  }

  const handleRequestChanges = () => {
    window.location.href = "mailto:soporte@converzia.ai?subject=Solicitud de cambios en ofertas";
  };

  return (
    <PageContainer>
      <PageHeader
        title="Mis Ofertas"
        description="Proyectos configurados para recibir y calificar leads"
        actions={
          offers.length > 0 && (
            <Button
              variant="secondary"
              leftIcon={<Mail className="h-4 w-4" />}
              onClick={handleRequestChanges}
            >
              Solicitar cambios
            </Button>
          )
        }
      />

      {/* Info alert */}
      {offers.length > 0 && (
        <Alert variant="info" className="mb-6">
          Las ofertas son configuradas por el equipo de Converzia. Si necesitás agregar o modificar una oferta, contactanos.
        </Alert>
      )}

      {offers.length === 0 ? (
        <NoOffersEmptyState 
          action={{
            label: "Contactar a Converzia",
            onClick: handleRequestChanges,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => {
            const status = statusConfig[offer.status];

            return (
              <Card key={offer.id} className="overflow-hidden hover:border-slate-600 transition-colors">
                {/* Image */}
                <div className="h-40 bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                  {offer.image_url ? (
                    <img
                      src={offer.image_url}
                      alt={offer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-12 w-12 text-slate-600" />
                  )}
                </div>

                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{offer.name}</h3>
                      {(offer.city || offer.zone) && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {offer.city}{offer.zone && `, ${offer.zone}`}
                        </p>
                      )}
                    </div>
                    <Badge variant={status?.variant || "default"} dot>
                      {status?.label || offer.status}
                    </Badge>
                  </div>

                  {/* Description */}
                  {offer.short_description && (
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {offer.short_description}
                    </p>
                  )}

                  {/* Price */}
                  {offer.price_from && (
                    <p className="text-lg font-semibold text-primary-400 mb-4">
                      {offer.price_to && offer.price_to !== offer.price_from
                        ? `${formatCurrency(offer.price_from, offer.currency)} - ${formatCurrency(offer.price_to, offer.currency)}`
                        : `Desde ${formatCurrency(offer.price_from, offer.currency)}`}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-slate-500 pt-3 border-t border-card-border">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {(offer as any).lead_count || 0} leads
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      {(offer as any).variant_count || 0} variantes
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

