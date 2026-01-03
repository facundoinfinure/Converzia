"use client";

import { useState } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  FileText,
  TrendingUp,
  User,
  Bot,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Select, CustomSelect } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useTenantOptions } from "@/lib/hooks/use-offers";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationTestResult {
  response: string;
  rag_chunks?: Array<{
    content: string;
    similarity: number;
    document_id?: string;
  }>;
  system_prompt?: string;
  extracted_fields?: Record<string, any>;
  score?: {
    total: number;
    breakdown: Record<string, number>;
  };
  errors?: string[];
}

export default function TestingConversationsPage() {
  const toast = useToast();
  const supabase = createClient();
  const { options: tenantOptions } = useTenantOptions();

  const [tenantId, setTenantId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [offerOptions, setOfferOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ConversationTestResult | null>(null);

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

  const handleSend = async () => {
    if (!message.trim() || !tenantId) {
      toast.error("Completá el mensaje y seleccioná un tenant");
      return;
    }

    setIsProcessing(true);
    setResult(null);

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    setConversation((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/testing/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          offer_id: offerId || null,
          message,
          conversation_history: conversation.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al procesar mensaje");
      }

      setResult(data);

      // Add assistant response to conversation
      if (data.response) {
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setConversation((prev) => [...prev, assistantMessage]);
      }

      setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al procesar mensaje");
      setResult({
        response: "",
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setConversation([]);
    setResult(null);
    setMessage("");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Testing de Conversaciones"
        description="Probá cómo responde el bot a diferentes mensajes"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Testing", href: "/admin/testing" },
          { label: "Conversaciones" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration and Input */}
        <div className="lg:col-span-1 space-y-4">
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
                  placeholder="Asociar a una oferta"
                />
              )}

              <div className="pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={handleClear}
                  fullWidth
                  disabled={conversation.length === 0}
                >
                  Limpiar conversación
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TextArea
                label="Mensaje del usuario"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribí un mensaje como si fueras un lead..."
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                isLoading={isProcessing}
                disabled={!message.trim() || !tenantId}
                fullWidth
                leftIcon={<Send className="h-4 w-4" />}
              >
                Enviar (Cmd/Ctrl + Enter)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Center: Conversation */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Conversación</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay mensajes aún</p>
                  <p className="text-sm mt-2">Escribí un mensaje para comenzar</p>
                </div>
              ) : (
                conversation.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-primary-500/20 text-white"
                          : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Results and Debug Info */}
        <div className="lg:col-span-1 space-y-4">
          {result && (
            <>
              {/* Extracted Fields */}
              {result.extracted_fields && Object.keys(result.extracted_fields).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Campos Extraídos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(result.extracted_fields).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium text-slate-400">{key}:</span>{" "}
                          <span className="text-white">
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Score */}
              {result.score && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total</span>
                        <Badge variant="primary">{result.score.total}/100</Badge>
                      </div>
                      {result.score.breakdown && (
                        <div className="space-y-1 pt-2 border-t border-slate-700">
                          {Object.entries(result.score.breakdown).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">{key}</span>
                              <span className="text-white">{value} pts</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* RAG Chunks */}
              {result.rag_chunks && result.rag_chunks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Contexto RAG ({result.rag_chunks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {result.rag_chunks.map((chunk, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-slate-800/50 border border-slate-700"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="secondary" className="text-xs">
                              Similarity: {(chunk.similarity * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-3">
                            {chunk.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* System Prompt */}
              {result.system_prompt && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">System Prompt Usado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
                      {result.system_prompt}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-red-400">Errores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
                      {result.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!result && (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">
                <p className="text-sm">Los resultados aparecerán aquí</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

