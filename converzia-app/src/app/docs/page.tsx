"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * API Documentation Page
 * 
 * This page renders the Swagger UI for the Converzia API.
 * The OpenAPI spec is loaded from /api/docs
 */
export default function ApiDocsPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Initialize Swagger UI after scripts are loaded
    if (loaded && typeof window !== "undefined" && (window as any).SwaggerUIBundle) {
      (window as any).SwaggerUIBundle({
        url: "/api/docs",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          (window as any).SwaggerUIBundle.presets.apis,
          (window as any).SwaggerUIStandalonePreset,
        ],
        plugins: [
          (window as any).SwaggerUIBundle.plugins.DownloadUrl,
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      });
    }
  }, [loaded]);

  return (
    <>
      {/* Swagger UI CSS */}
      <link
        rel="stylesheet"
        type="text/css"
        href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
      />

      {/* Swagger UI Scripts */}
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
        onLoad={() => setLoaded(true)}
      />
      <Script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" />

      {/* Custom styles for dark mode compatibility */}
      <style>{`
        body {
          margin: 0;
          background: #1a1a2e;
        }
        #swagger-ui {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }
        .swagger-ui {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 30px 0;
        }
        .swagger-ui .info .title {
          color: #ffffff;
        }
        .swagger-ui .info .description {
          color: #b0b0c0;
        }
        .swagger-ui .scheme-container {
          background: #232340;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .swagger-ui .opblock-tag {
          color: #ffffff;
          border-color: #3a3a5a;
        }
        .swagger-ui .opblock {
          background: #232340;
          border-color: #3a3a5a;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .swagger-ui .opblock .opblock-summary {
          padding: 12px 15px;
        }
        .swagger-ui .opblock-summary-method {
          border-radius: 4px;
          min-width: 70px;
        }
        .swagger-ui .opblock-summary-path {
          color: #e0e0f0;
        }
        .swagger-ui .opblock-summary-description {
          color: #a0a0b0;
        }
        .swagger-ui .opblock-body {
          background: #1e1e35;
        }
        .swagger-ui .parameter__name {
          color: #60a5fa;
        }
        .swagger-ui .parameter__type {
          color: #34d399;
        }
        .swagger-ui .response-col_status {
          color: #fbbf24;
        }
        .swagger-ui table tbody tr td {
          color: #d0d0e0;
          border-color: #3a3a5a;
        }
        .swagger-ui .btn {
          border-radius: 6px;
        }
        .swagger-ui .btn.execute {
          background: #3b82f6;
          border-color: #3b82f6;
        }
        .swagger-ui .btn.execute:hover {
          background: #2563eb;
        }
        .swagger-ui .model-box {
          background: #1e1e35;
        }
        .swagger-ui .model {
          color: #d0d0e0;
        }
        .swagger-ui section.models {
          border-color: #3a3a5a;
        }
        .swagger-ui section.models h4 {
          color: #ffffff;
        }
        .swagger-ui .highlight-code {
          background: #1e1e35 !important;
        }
        .swagger-ui pre.microlight {
          background: #1e1e35 !important;
          border-radius: 6px;
          padding: 12px;
        }
        @media (prefers-color-scheme: light) {
          body {
            background: #f8fafc;
          }
          .swagger-ui .info .title {
            color: #1e293b;
          }
          .swagger-ui .info .description {
            color: #64748b;
          }
          .swagger-ui .scheme-container {
            background: #ffffff;
            border: 1px solid #e2e8f0;
          }
          .swagger-ui .opblock-tag {
            color: #1e293b;
            border-color: #e2e8f0;
          }
          .swagger-ui .opblock {
            background: #ffffff;
            border-color: #e2e8f0;
          }
          .swagger-ui .opblock-body {
            background: #f8fafc;
          }
          .swagger-ui .opblock-summary-path {
            color: #1e293b;
          }
          .swagger-ui .opblock-summary-description {
            color: #64748b;
          }
          .swagger-ui table tbody tr td {
            color: #334155;
            border-color: #e2e8f0;
          }
          .swagger-ui .model-box {
            background: #f8fafc;
          }
          .swagger-ui .model {
            color: #334155;
          }
          .swagger-ui section.models {
            border-color: #e2e8f0;
          }
          .swagger-ui section.models h4 {
            color: #1e293b;
          }
          .swagger-ui .highlight-code {
            background: #f1f5f9 !important;
          }
          .swagger-ui pre.microlight {
            background: #f1f5f9 !important;
          }
        }
      `}</style>

      {/* Swagger UI container */}
      <div id="swagger-ui" />
    </>
  );
}
