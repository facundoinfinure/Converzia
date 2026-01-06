"use client";

import { useState, useEffect } from "react";
import { FileText, Eye, Save, RefreshCw } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { CustomSelect } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useTenantOptions } from "@/lib/hooks/use-offers";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

export default function TestingPromptsPage() {
  const toast = useToast();
  const supabase = createClient();
  const { options: tenantOptions } = useTenantOptions();

  const [tenantId, setTenantId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [offerOptions, setOfferOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [preview, setPreview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "test">("edit");

  // Load default prompt template
  useEffect(() => {
    const loadDefaultPrompt = async () => {
      try {
        const response = await fetch("/prompts/qualification_system_prompt.md");
        if (response.ok) {
          const text = await response.text();
          setPromptTemplate(text);
        } else {
          // Fallback template
          setPromptTemplate(`# System Prompt: Lead Qualification Assistant

## Identity
Sos el asistente de calificación de **{{tenant_name}}**. Representás a la desarrolladora/constructora para ayudar a potenciales compradores de sus proyectos inmobiliarios.

## Objective
Tu objetivo es **calificar leads** obteniendo información clave, NO cerrar ventas. Una vez que tengas la información necesaria, el lead pasa al equipo comercial.

## Required Fields (Lead Ready)
Debés obtener estos campos para considerar un lead calificado:
1. **Nombre completo**
2. **Presupuesto aproximado** (rango en USD o ARS)
3. **Zonas de interés** (barrios, ciudades)
4. **Timing** (cuándo quiere mudarse/concretar)
5. **Intención** (compra, alquiler, inversión)

## STRICT RULES (Never Break)
### 1. Never Promise or Confirm
- ❌ "Sí, está disponible la unidad del piso 8"
- ❌ "La cuota es de $X por mes"
- ❌ "Te puedo hacer un 10% de descuento"

### 2. Always Use Conditional Language
- ✅ "Según la información que tengo, hay opciones en ese rango. Se confirma al avanzar con el equipo."
- ✅ "Hay diferentes planes de financiación que se revisan caso a caso."
`);
        }
      } catch (error) {
        console.error("Error loading prompt template:", error);
      }
    };

    loadDefaultPrompt();
  }, []);

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

  // Generate preview with variables replaced
  const generatePreview = async () => {
    if (!tenantId || !promptTemplate) {
      setPreview("Seleccioná un tenant para ver el preview");
      return;
    }

    setIsLoading(true);

    try {
      // Get tenant name
      const { data: tenant } = await queryWithTimeout(
        supabase
          .from("tenants")
          .select("name")
          .eq("id", tenantId)
          .single(),
        10000,
        "get tenant for preview"
      );

      let offerName = null;
      if (offerId) {
        const { data: offer } = await queryWithTimeout(
          supabase
            .from("offers")
            .select("name")
            .eq("id", offerId)
            .single(),
          10000,
          "get offer for preview"
        );
        offerName = (offer as any)?.name;
      }

      // Replace variables
      let previewText = promptTemplate
        .replace(/\{\{tenant_name\}\}/g, (tenant as any)?.name || "{{tenant_name}}")
        .replace(/\{\{offer_name\}\}/g, offerName || "{{offer_name}}")
        .replace(/\{\{lead_name\}\}/g, "Juan Pérez")
        .replace(/\{\{qualification_fields\}\}/g, JSON.stringify({
          budget: { min: 50000, max: 100000 },
          zone: ["Palermo", "Belgrano"],
          timing: "En 3-6 meses",
        }, null, 2))
        .replace(/\{\{rag_context\}\}/g, "Información del proyecto: Ubicado en Palermo, 2 y 3 ambientes disponibles...");

      setPreview(previewText);
    } catch (error) {
      setPreview("Error al generar preview");
      console.error("Error generating preview:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate preview when template or tenant changes
  useEffect(() => {
    if (promptTemplate && tenantId) {
      generatePreview();
    }
  }, [promptTemplate, tenantId, offerId]);

  const handleSave = async () => {
    if (!promptTemplate.trim()) {
      toast.error("El prompt no puede estar vacío");
      return;
    }

    setIsSaving(true);

    try {
      // Save to app_settings (or create a new table for prompt versions)
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "qualification_system_prompt",
          value: promptTemplate,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "key",
        });

      if (error) throw error;

      toast.success("Prompt guardado correctamente");
    } catch (error) {
      toast.error("Error al guardar el prompt");
      console.error("Error saving prompt:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Testing de System Prompts"
        description="Editá y probá los prompts del sistema"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Testing", href: "/admin/testing" },
          { label: "Prompts" },
        ]}
        actions={
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Guardar Prompt
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Configuration */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomSelect
                label="Tenant (para preview)"
                value={tenantId}
                onChange={(val) => {
                  setTenantId(val);
                  fetchOffers(val);
                  setOfferId("");
                }}
                options={tenantOptions}
                placeholder="Seleccionar tenant"
              />

              {tenantId && offerOptions.length > 0 && (
                <CustomSelect
                  label="Oferta (opcional)"
                  value={offerId}
                  onChange={setOfferId}
                  options={[{ value: "", label: "General" }, ...offerOptions]}
                  placeholder="Asociar a oferta"
                />
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-slate-400 mb-2">Variables disponibles:</p>
                <div className="space-y-1 text-xs">
                  <code className="block p-1 bg-slate-800 rounded">{"{{tenant_name}}"}</code>
                  <code className="block p-1 bg-slate-800 rounded">{"{{offer_name}}"}</code>
                  <code className="block p-1 bg-slate-800 rounded">{"{{lead_name}}"}</code>
                  <code className="block p-1 bg-slate-800 rounded">{"{{qualification_fields}}"}</code>
                  <code className="block p-1 bg-slate-800 rounded">{"{{rag_context}}"}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Editor and Preview */}
        <div className="lg:col-span-3">
          <Card>
            <Tabs 
              defaultValue="edit" 
              value={activeTab} 
              onChange={(value) => setActiveTab(value as "edit" | "preview" | "test")}
            >
              <TabsList>
                <TabTrigger value="edit">Editar</TabTrigger>
                <TabTrigger value="preview">Preview</TabTrigger>
                <TabTrigger value="test">Probar</TabTrigger>
              </TabsList>

              <TabContent value="edit">
                <CardContent className="p-6">
                  <TextArea
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    placeholder="Escribí el system prompt aquí..."
                    rows={20}
                    className="font-mono text-sm"
                  />
                </CardContent>
              </TabContent>

              <TabContent value="preview">
                <CardContent className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary-400" />
                    </div>
                  ) : preview ? (
                    <pre className="text-sm text-slate-200 bg-slate-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {preview}
                    </pre>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Seleccioná un tenant para ver el preview</p>
                    </div>
                  )}
                </CardContent>
              </TabContent>

              <TabContent value="test">
                <CardContent className="p-6">
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Prueba de prompts próximamente</p>
                    <p className="text-sm mt-2">
                      Usá la página de Testing de Conversaciones para probar el prompt completo
                    </p>
                  </div>
                </CardContent>
              </TabContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

