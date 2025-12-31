"use client";

import { useState, useEffect } from "react";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { PlatformType } from "./PlatformButton";

// Types for Meta Ads structure
interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
  };
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  ads: MetaAd[];
}

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  adsets: MetaAdSet[];
}

interface AdAccount {
  id: string;
  account_id: string;
  name: string;
}

interface PlatformAdPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ad: { 
    platform: PlatformType;
    ad_id: string;
    ad_name: string;
    adset_id: string;
    adset_name: string;
    campaign_id: string;
    campaign_name: string;
  }) => void;
  tenantId?: string; // Optional - Meta connection is global
  platform: PlatformType;
}

export function PlatformAdPicker({
  isOpen,
  onClose,
  onSelect,
  tenantId,
  platform,
}: PlatformAdPickerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  // Ad accounts
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  // Campaign structure
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());
  
  // Selected ad
  const [selectedAd, setSelectedAd] = useState<{
    ad: MetaAd;
    adset: MetaAdSet;
    campaign: MetaCampaign;
  } | null>(null);

  // Fetch ad accounts on mount
  useEffect(() => {
    if (isOpen && platform === "META") {
      fetchAdAccounts();
    }
  }, [isOpen, platform]);

  // Fetch campaigns when account is selected
  useEffect(() => {
    if (selectedAccountId) {
      fetchCampaigns(selectedAccountId);
    }
  }, [selectedAccountId]);

  const fetchAdAccounts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Meta connection is global (Admin's account), no tenant_id needed
      const response = await fetch(`/api/integrations/meta/ads`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch ad accounts");
      }
      
      setAdAccounts(data.ad_accounts || []);
      
      // Auto-select first account if only one
      if (data.ad_accounts?.length === 1) {
        setSelectedAccountId(data.ad_accounts[0].account_id || data.ad_accounts[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCampaigns = async (accountId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/integrations/meta/ads?account_id=${accountId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch campaigns");
      }
      
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  const toggleAdset = (adsetId: string) => {
    setExpandedAdsets((prev) => {
      const next = new Set(prev);
      if (next.has(adsetId)) {
        next.delete(adsetId);
      } else {
        next.add(adsetId);
      }
      return next;
    });
  };

  const handleSelectAd = (ad: MetaAd, adset: MetaAdSet, campaign: MetaCampaign) => {
    setSelectedAd({ ad, adset, campaign });
  };

  const handleConfirm = () => {
    if (selectedAd) {
      onSelect({
        platform,
        ad_id: selectedAd.ad.id,
        ad_name: selectedAd.ad.name,
        adset_id: selectedAd.adset.id,
        adset_name: selectedAd.adset.name,
        campaign_id: selectedAd.campaign.id,
        campaign_name: selectedAd.campaign.name,
      });
      onClose();
    }
  };

  // Filter campaigns by search
  const filteredCampaigns = campaigns.filter((campaign) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    
    // Check campaign name
    if (campaign.name.toLowerCase().includes(searchLower)) return true;
    
    // Check adsets and ads
    return campaign.adsets.some(
      (adset) =>
        adset.name.toLowerCase().includes(searchLower) ||
        adset.ads.some((ad) => 
          ad.name.toLowerCase().includes(searchLower) ||
          ad.id.includes(search)
        )
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "ACTIVE":
        return <Badge variant="success" size="sm">Activo</Badge>;
      case "PAUSED":
        return <Badge variant="warning" size="sm">Pausado</Badge>;
      case "ARCHIVED":
      case "DELETED":
        return <Badge variant="secondary" size="sm">Archivado</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Seleccionar Ad de ${platform === "META" ? "Meta" : platform}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAd}
            leftIcon={<LinkIcon className="h-4 w-4" />}
          >
            Vincular Ad
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Account selector */}
        {adAccounts.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Cuenta publicitaria
            </label>
            <select
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
            >
              <option value="">Seleccionar cuenta...</option>
              {adAccounts.map((account) => (
                <option key={account.id} value={account.account_id || account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        {campaigns.length > 0 && (
          <Input
            placeholder="Buscar campaña, adset o ad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        )}

        {/* Error state */}
        {error && (
          <Alert variant="error" title="Error">
            {error}
          </Alert>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && campaigns.length === 0 && selectedAccountId && (
          <EmptyState
            icon={<AlertCircle className="h-12 w-12" />}
            title="No se encontraron campañas"
            description="No hay campañas en esta cuenta publicitaria."
          />
        )}

        {/* Campaign tree */}
        {!isLoading && filteredCampaigns.length > 0 && (
          <div className="max-h-[400px] overflow-auto border border-[var(--border-primary)] rounded-lg">
            {filteredCampaigns.map((campaign) => (
              <div key={campaign.id} className="border-b border-[var(--border-primary)] last:border-b-0">
                {/* Campaign row */}
                <button
                  type="button"
                  onClick={() => toggleCampaign(campaign.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  {expandedCampaigns.has(campaign.id) ? (
                    <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {campaign.adsets.length} adsets
                    </p>
                  </div>
                  {getStatusBadge(campaign.status)}
                </button>

                {/* Adsets */}
                {expandedCampaigns.has(campaign.id) && (
                  <div className="pl-8 bg-[var(--bg-secondary)]/30">
                    {campaign.adsets.map((adset) => (
                      <div key={adset.id}>
                        {/* Adset row */}
                        <button
                          type="button"
                          onClick={() => toggleAdset(adset.id)}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          {expandedAdsets.has(adset.id) ? (
                            <ChevronDown className="h-3 w-3 text-[var(--text-tertiary)]" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-[var(--text-tertiary)]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--text-primary)] truncate">
                              {adset.name}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {adset.ads.length} ads
                            </p>
                          </div>
                          {getStatusBadge(adset.status)}
                        </button>

                        {/* Ads */}
                        {expandedAdsets.has(adset.id) && (
                          <div className="pl-8">
                            {adset.ads.map((ad) => {
                              const isSelected = selectedAd?.ad.id === ad.id;
                              return (
                                <button
                                  key={ad.id}
                                  type="button"
                                  onClick={() => handleSelectAd(ad, adset, campaign)}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                                    isSelected
                                      ? "bg-[var(--accent-primary)]/10 border-l-2 border-[var(--accent-primary)]"
                                      : "hover:bg-[var(--bg-tertiary)]"
                                  )}
                                >
                                  <div className={cn(
                                    "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                                    isSelected
                                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]"
                                      : "border-[var(--border-secondary)]"
                                  )}>
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-[var(--text-primary)] truncate">
                                      {ad.name}
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)] font-mono">
                                      ID: {ad.id}
                                    </p>
                                  </div>
                                  {getStatusBadge(ad.status)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Selected ad summary */}
        {selectedAd && (
          <div className="p-4 bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/20 rounded-lg">
            <p className="text-sm font-medium text-[var(--accent-primary)]">
              Ad seleccionado
            </p>
            <p className="text-[var(--text-primary)] font-medium mt-1">
              {selectedAd.ad.name}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {selectedAd.campaign.name} → {selectedAd.adset.name}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

