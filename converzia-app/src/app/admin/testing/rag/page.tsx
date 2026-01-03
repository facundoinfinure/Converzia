"use client";

import { useState } from "react";
import { Search, FileText, TrendingUp } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { CustomSelect } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useTenantOptions } from "@/lib/hooks/use-offers";
import { createClient } from "@/lib/supabase/client";

interface RagTestResult {
  chunks: Array<{
    content: string;
    similarity: number;
    document_id?: string;
    chunk_id?: string;
    metadata?: Record<string, any>;
  }>;
  query: string;
  tenant_id: string;
  offer_id?: string;
}

export default function TestingRagPage() {
  const toast = useToast();
  const { options: tenantOptions } = useTenantOptions();
  const supabase = createClient();

  const [tenantId, setTenantId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [offerOptions, setOfferOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<RagTestResult | null>(null);

  // Fetch offers when tenant changes
  const fetchOffers = async (tenantId: string) => {
    if (!tenantId) {
      setOfferOptions([]);
      setOfferId("");
      return;
    }

    const { data } = await supabase
      .from("offers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name");

    if (data) {
      setOfferOptions(data.map((o: any) => ({ value: o.id, label: o.name })));
    }
  };

  const handleSearch = async () => {
    if (!query.trim() || !tenantId) {
      toast.error("Completá la búsqueda y seleccioná un tenant");
      return;
    }

    setIsSearching(true);
    setResults(null);

    try {
      const response = await fetch("/api/testing/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          offer_id: offerId || null,
          query,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al buscar en RAG");
      }

      setResults(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al buscar");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Testing de RAG"
        description="Probá búsquedas en la base de conocimiento"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Testing", href: "/admin/testing" },
          { label: "RAG" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomSelect
                label="Tenant"
                value={tenantId}
                onChange={(val) => {
                  setTenantId(val);
                  fetchOffers(val);
                  setOfferId("");
                }}
                options={tenantOptions}
                placeholder="Seleccionar tenant"
                required
              />

              {tenantId && offerOptions.length > 0 && (
                <CustomSelect
                  label="Oferta (opcional)"
                  value={offerId}
                  onChange={setOfferId}
                  options={[{ value: "", label: "General del tenant" }, ...offerOptions]}
                  placeholder="Buscar en oferta específica"
                />
              )}

              <TextArea
                label="Query de búsqueda"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="¿Qué información buscás?"
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSearch();
                  }
                }}
              />

              <Button
                onClick={handleSearch}
                isLoading={isSearching}
                disabled={!query.trim() || !tenantId}
                fullWidth
                leftIcon={<Search className="h-4 w-4" />}
              >
                Buscar (Cmd/Ctrl + Enter)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Resultados
                {results && (
                  <Badge variant="secondary" className="ml-2">
                    {results.chunks.length} chunks
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!results ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay resultados aún</p>
                  <p className="text-sm mt-2">Hacé una búsqueda para ver resultados</p>
                </div>
              ) : results.chunks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>No se encontraron chunks relevantes</p>
                  <p className="text-sm mt-2">Probá con otra búsqueda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.chunks.map((chunk, idx) => (
                    <Card key={idx} className="bg-slate-800/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">#{idx + 1}</Badge>
                            <Badge variant="primary">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {(chunk.similarity * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          {chunk.document_id && (
                            <Badge variant="outline" className="text-xs">
                              Doc: {chunk.document_id.substring(0, 8)}...
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">
                          {chunk.content}
                        </p>
                        {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <p className="text-xs text-slate-400 mb-1">Metadata:</p>
                            <pre className="text-xs text-slate-500 bg-slate-900 p-2 rounded overflow-x-auto">
                              {JSON.stringify(chunk.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

