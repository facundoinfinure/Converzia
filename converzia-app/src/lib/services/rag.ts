import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { generateEmbedding } from "./openai";
import { extractTextFromPdf, cleanPdfText } from "./pdf";

// ============================================
// RAG (Retrieval Augmented Generation) Service
// ============================================

export interface RagSource {
  id: string;
  tenant_id: string;
  offer_id: string | null;
  source_type: "PDF" | "URL" | "WEBSITE_SCRAPE" | "MANUAL";
  name: string;
  source_url?: string;
  storage_path?: string;
  scrape_config?: ScrapeConfig;
}

export interface ScrapeConfig {
  root_url: string;
  allowlist: string[];
  blocklist: string[];
  max_pages: number;
  follow_links: boolean;
}

export interface RagDocument {
  id: string;
  source_id: string;
  tenant_id: string;
  offer_id: string | null;
  title: string;
  content: string;
  content_hash: string;
  doc_type: string;
}

export interface RagChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

export interface RagSearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

// ============================================
// Search Functions
// ============================================

/**
 * Search RAG knowledge base using hybrid search (vector + full-text)
 */
export async function searchKnowledge(
  query: string,
  tenantId: string,
  offerId?: string,
  limit: number = 5
): Promise<RagSearchResult[]> {
  const supabase = createAdminClient();

  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    // Use hybrid search function from database
    const { data: results, error } = await queryWithTimeout(
      supabase.rpc("search_rag_chunks", {
        p_tenant_id: tenantId,
        p_offer_id: offerId || null,
        p_query_embedding: embedding,
        p_query_text: query,
        p_limit: limit,
        p_vector_weight: 0.7,
        p_text_weight: 0.3,
      }),
      15000, // 15 seconds for RAG search
      "RAG hybrid search"
    );

    if (error) {
      console.error("RAG search error:", error);
      // Fall back to vector-only search
      return await vectorOnlySearch(embedding, tenantId, offerId, limit);
    }

    return (results || []).map((r: any) => ({
      chunk_id: r.chunk_id,
      document_id: r.document_id,
      content: r.content,
      metadata: r.metadata || {},
      similarity: r.combined_score || r.vector_score || 0,
    }));
  } catch (error) {
    console.error("Error in RAG search:", error);
    return [];
  }
}

/**
 * Vector-only search (fallback)
 */
async function vectorOnlySearch(
  embedding: number[],
  tenantId: string,
  offerId?: string,
  limit: number = 5
): Promise<RagSearchResult[]> {
  const supabase = createAdminClient();

  const { data: results, error } = await queryWithTimeout(
    supabase.rpc("search_rag_chunks_vector", {
      p_tenant_id: tenantId,
      p_offer_id: offerId || null,
      p_query_embedding: embedding,
      p_limit: limit,
    }),
    15000, // 15 seconds for vector search
    "RAG vector search"
  );

  if (error) {
    console.error("Vector search error:", error);
    return [];
  }

  return (results || []).map((r: any) => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    content: r.content,
    metadata: r.metadata || {},
    similarity: r.similarity || 0,
  }));
}

/**
 * Get context for conversation from RAG
 */
export async function getConversationContext(
  userMessage: string,
  tenantId: string,
  offerId?: string
): Promise<string> {
  const results = await searchKnowledge(userMessage, tenantId, offerId, 3);

  if (results.length === 0) {
    return "";
  }

  // Format context for LLM
  const contextParts = results.map((r, i) => {
    const docType = r.metadata.doc_type || "Información";
    return `[${docType}]: ${r.content}`;
  });

  return contextParts.join("\n\n");
}

// ============================================
// Ingestion Functions
// ============================================

/**
 * Ingest a document into the RAG system
 */
export async function ingestDocument(
  sourceId: string,
  content: string,
  metadata: {
    title: string;
    url?: string;
    doc_type: string;
  }
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get source info
    const { data: source, error: sourceError } = await queryWithTimeout(
      supabase
        .from("rag_sources")
        .select("*")
        .eq("id", sourceId)
        .single(),
      10000,
      `fetch RAG source ${sourceId}`
    );

    if (sourceError || !source) {
      return { success: false, chunkCount: 0, error: "Source not found" };
    }

    // Generate content hash for deduplication
    const contentHash = await generateHash(content);

    // Check for existing document with same hash
    const { data: existingDoc } = await queryWithTimeout(
      supabase
        .from("rag_documents")
        .select("id")
        .eq("source_id", sourceId)
        .eq("content_hash", contentHash)
        .single(),
      10000,
      "check existing document"
    );

    if (existingDoc) {
      return { success: true, chunkCount: 0, error: "Document already exists (same content)" };
    }

    // Mark previous versions as not current
    await queryWithTimeout(
      supabase
        .from("rag_documents")
        .update({ is_current: false })
        .eq("source_id", sourceId),
      10000,
      "mark previous documents not current"
    );

    // Create document record
    const { data: doc, error: docError } = await queryWithTimeout(
      supabase
        .from("rag_documents")
        .insert({
          source_id: sourceId,
          tenant_id: source.tenant_id,
          offer_id: source.offer_id,
          title: metadata.title,
          url: metadata.url,
          raw_content: content,
          cleaned_content: cleanContent(content),
          content_hash: contentHash,
          status: "PROCESSING",
          doc_type: metadata.doc_type,
          word_count: content.split(/\s+/).length,
        })
        .select()
        .single(),
      30000,
      "create RAG document"
    );

    if (docError || !doc) {
      return { success: false, chunkCount: 0, error: docError?.message || "Failed to create document" };
    }

    // Chunk the content
    const chunks = chunkContent(doc.cleaned_content, {
      maxTokens: 500,
      overlap: 50,
    });

    // Generate embeddings and insert chunks
    let chunkCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const embedding = await generateEmbedding(chunk);

        await queryWithTimeout(
          supabase.from("rag_chunks").insert({
            document_id: doc.id,
            source_id: sourceId,
            tenant_id: source.tenant_id,
            offer_id: source.offer_id,
            content: chunk,
            embedding: embedding,
            chunk_index: i,
            metadata: {
              doc_type: metadata.doc_type,
              title: metadata.title,
            },
            token_count: estimateTokens(chunk),
          }),
          10000,
          `insert RAG chunk ${i}`
        );

        chunkCount++;
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
      }
    }

    // Update document status
    await queryWithTimeout(
      supabase
        .from("rag_documents")
        .update({
          status: "COMPLETED",
          chunk_count: chunkCount,
          processed_at: new Date().toISOString(),
        })
        .eq("id", doc.id),
      10000,
      "update document status to COMPLETED"
    );

    // Update source last processed
    await queryWithTimeout(
      supabase
        .from("rag_sources")
        .update({ last_processed_at: new Date().toISOString() })
        .eq("id", sourceId),
      10000,
      "update source last processed"
    );

    return { success: true, chunkCount };
  } catch (error) {
    console.error("Document ingestion error:", error);
    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ingest content from a URL
 */
export async function ingestFromUrl(
  sourceId: string,
  url: string
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  try {
    // Fetch URL content
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "Converzia-Bot/1.0 (+https://converzia.com)",
        },
      },
      30000 // 30 seconds for URL fetching
    );

    if (!response.ok) {
      return { success: false, chunkCount: 0, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    
    // Extract text content from HTML
    const textContent = extractTextFromHtml(html);
    const title = extractTitleFromHtml(html) || url;

    return await ingestDocument(sourceId, textContent, {
      title,
      url,
      doc_type: "LANDING",
    });
  } catch (error) {
    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : "Failed to fetch URL",
    };
  }
}

/**
 * Ingest manual text content
 */
export async function ingestManualContent(
  tenantId: string,
  offerId: string | null,
  content: string,
  title: string,
  docType: string = "FAQ"
): Promise<{ success: boolean; sourceId?: string; chunkCount: number; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Create source
    const { data: source, error: sourceError } = await queryWithTimeout(
      supabase
        .from("rag_sources")
        .insert({
          tenant_id: tenantId,
          offer_id: offerId,
          source_type: "MANUAL",
          name: title,
          is_active: true,
        })
        .select()
        .single(),
      30000,
      "create RAG source"
    );

    if (sourceError || !source) {
      return { success: false, chunkCount: 0, error: sourceError?.message || "Failed to create source" };
    }

    const result = await ingestDocument(source.id, content, {
      title,
      doc_type: docType,
    });

    return {
      ...result,
      sourceId: source.id,
    };
  } catch (error) {
    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Clean content for processing
 */
function cleanContent(content: string): string {
  return content
    // Normalize whitespace
    .replace(/\s+/g, " ")
    // Remove special characters
    .replace(/[^\w\s.,;:!?¿¡áéíóúüñ()-]/gi, " ")
    // Trim
    .trim();
}

/**
 * Chunk content into smaller pieces
 */
function chunkContent(
  content: string,
  options: { maxTokens: number; overlap: number }
): string[] {
  const { maxTokens, overlap } = options;
  const chunks: string[] = [];

  // Split by paragraphs first
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    const currentTokens = estimateTokens(currentChunk);

    if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-overlap);
      currentChunk = overlapWords.join(" ") + " " + paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  // Don't forget last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Roughly 4 characters per token for Spanish/English
  return Math.ceil(text.length / 4);
}

/**
 * Generate content hash for deduplication
 */
async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract text from HTML
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

  // Replace block elements with newlines
  text = text
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  // Clean up whitespace
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Extract title from HTML
 */
function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

// ============================================
// Delete Functions
// ============================================

/**
 * Delete a RAG source and all its documents/chunks
 */
export async function deleteRagSource(sourceId: string): Promise<boolean> {
  const supabase = createAdminClient();

  try {
    // Cascade delete will handle documents and chunks
    const { error } = await queryWithTimeout(
      supabase
        .from("rag_sources")
        .delete()
        .eq("id", sourceId),
      10000,
      `delete RAG source ${sourceId}`
    );

    return !error;
  } catch (error) {
    console.error("Error deleting RAG source:", error);
    return false;
  }
}

/**
 * Ingest content from a PDF file
 */
export async function ingestFromPdf(
  sourceId: string,
  pdfBuffer: Buffer,
  title: string
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  try {
    // Extract text from PDF
    const { text, numPages, info } = await extractTextFromPdf(pdfBuffer);
    const cleanedText = cleanPdfText(text);

    if (!cleanedText || cleanedText.length < 10) {
      return {
        success: false,
        chunkCount: 0,
        error: "No text content found in PDF",
      };
    }

    // Use standard ingestDocument with PDF metadata
    return await ingestDocument(sourceId, cleanedText, {
      title: title || (info.Title as string) || "PDF Document",
      doc_type: "PDF",
    });
  } catch (error) {
    console.error("PDF ingestion error:", error);
    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : "Failed to process PDF",
    };
  }
}

/**
 * Ingest PDF from Supabase Storage
 */
export async function ingestFromStoragePdf(
  sourceId: string,
  storagePath: string,
  title: string
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Download file from storage
    // Storage operations don't need queryWithTimeout, but we can add error handling
    const { data, error } = await supabase.storage
      .from("rag-documents")
      .download(storagePath);

    if (error) {
      return {
        success: false,
        chunkCount: 0,
        error: `Failed to download PDF: ${error.message}`,
      };
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await ingestFromPdf(sourceId, buffer, title);
  } catch (error) {
    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : "Failed to process stored PDF",
    };
  }
}

/**
 * Re-index all documents for a source
 */
export async function reindexSource(sourceId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get source
    const { data: source } = await queryWithTimeout(
      supabase
        .from("rag_sources")
        .select("*")
        .eq("id", sourceId)
        .single(),
      10000,
      `fetch RAG source ${sourceId} for reindex`
    );

    if (!source) {
      return { success: false, error: "Source not found" };
    }

    // Delete existing chunks
    await queryWithTimeout(
      supabase
        .from("rag_chunks")
        .delete()
        .eq("source_id", sourceId),
      10000,
      "delete existing chunks for reindex"
    );

    // Re-process based on source type
    if (source.source_type === "URL" && source.source_url) {
      return await ingestFromUrl(sourceId, source.source_url);
    }

    if (source.source_type === "PDF" && source.storage_path) {
      return await ingestFromStoragePdf(sourceId, source.storage_path, source.name);
    }

    // For manual content, get from existing document
    const { data: doc } = await queryWithTimeout(
      supabase
        .from("rag_documents")
        .select("raw_content, title, doc_type")
        .eq("source_id", sourceId)
        .eq("is_current", true)
        .single(),
      10000,
      "get document for reindex"
    );

    if (doc) {
      return await ingestDocument(sourceId, doc.raw_content, {
        title: doc.title,
        doc_type: doc.doc_type,
      });
    }

    return { success: false, error: "No content to reindex" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

