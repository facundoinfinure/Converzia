// ============================================
// PDF Processing Service
// ============================================

/**
 * Extract text content from a PDF buffer
 * Uses pdf-parse library
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{
  text: string;
  numPages: number;
  info: Record<string, unknown>;
}> {
  // Dynamic import to avoid issues with server/client bundling
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;

  try {
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info || {},
    };
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to parse PDF"
    );
  }
}

/**
 * Extract text from a PDF stored in Supabase Storage
 */
export async function extractTextFromStoragePdf(
  supabase: any,
  bucket: string,
  path: string
): Promise<{
  text: string;
  numPages: number;
  info: Record<string, unknown>;
}> {
  // Download the file
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) {
    throw new Error(`Failed to download PDF: ${error.message}`);
  }

  // Convert blob to buffer
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return extractTextFromPdf(buffer);
}

/**
 * Clean and normalize extracted PDF text
 * Removes excessive whitespace and normalizes line breaks
 */
export function cleanPdfText(text: string): string {
  return text
    // Replace multiple newlines with double newline (paragraph break)
    .replace(/\n{3,}/g, "\n\n")
    // Replace multiple spaces with single space
    .replace(/[ \t]+/g, " ")
    // Remove leading/trailing whitespace from each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    // Remove empty lines at start and end
    .trim();
}

/**
 * Split PDF text into sections based on common heading patterns
 * Useful for better chunking in RAG
 */
export function splitPdfIntoSections(text: string): Array<{
  heading: string | null;
  content: string;
}> {
  const sections: Array<{ heading: string | null; content: string }> = [];
  
  // Common heading patterns (numbered sections, capitalized lines, etc.)
  const headingPatterns = [
    /^(\d+\.?\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúüñ\s]+)$/m, // "1. Título" or "1 Título"
    /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,})$/m, // ALL CAPS HEADINGS
    /^(#{1,3}\s+.+)$/m, // Markdown-style headers
  ];

  // Split by potential headings
  const lines = text.split("\n");
  let currentSection: { heading: string | null; content: string[] } = {
    heading: null,
    content: [],
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      currentSection.content.push("");
      continue;
    }

    // Check if this line looks like a heading
    let isHeading = false;
    for (const pattern of headingPatterns) {
      if (pattern.test(trimmedLine)) {
        // Save current section if it has content
        if (currentSection.content.length > 0) {
          sections.push({
            heading: currentSection.heading,
            content: currentSection.content.join("\n").trim(),
          });
        }
        // Start new section
        currentSection = {
          heading: trimmedLine,
          content: [],
        };
        isHeading = true;
        break;
      }
    }

    if (!isHeading) {
      currentSection.content.push(trimmedLine);
    }
  }

  // Don't forget the last section
  if (currentSection.content.length > 0 || currentSection.heading) {
    sections.push({
      heading: currentSection.heading,
      content: currentSection.content.join("\n").trim(),
    });
  }

  return sections;
}














