import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

// Force all pages to be dynamically rendered
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFBFC" },
    { media: "(prefers-color-scheme: dark)", color: "#12151E" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Converzia",
    template: "%s | Converzia",
  },
  description: "Plataforma de calificación de leads multi-tenant para el sector inmobiliario",
  keywords: ["leads", "inmobiliario", "calificación", "whatsapp", "chatbot"],
  authors: [{ name: "Converzia" }],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Converzia",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Preload fonts for performance */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased min-h-screen min-h-[100dvh] bg-[var(--bg-secondary)] text-[var(--text-primary)] font-[var(--font-body)]">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
