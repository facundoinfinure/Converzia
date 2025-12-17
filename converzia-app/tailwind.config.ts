import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card-bg)",
          border: "var(--card-border)",
        },
        // Mercury color palette
        mercury: {
          bg: {
            primary: "var(--mercury-bg-primary)",
            secondary: "var(--mercury-bg-secondary)",
            tertiary: "var(--mercury-bg-tertiary)",
          },
          text: {
            primary: "var(--mercury-text-primary)",
            secondary: "var(--mercury-text-secondary)",
            tertiary: "var(--mercury-text-tertiary)",
          },
          primary: "var(--mercury-primary)",
          border: "var(--mercury-border)",
          success: "var(--mercury-success)",
          warning: "var(--mercury-warning)",
          error: "var(--mercury-error)",
          info: "var(--mercury-info)",
        },
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6", // Mercury blue
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        accent: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      fontFamily: {
        sans: ["Inter", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        'mercury-sm': 'var(--mercury-shadow-sm)',
        'mercury': 'var(--mercury-shadow)',
        'mercury-md': 'var(--mercury-shadow-md)',
      },
      borderRadius: {
        'mercury-sm': 'var(--mercury-radius-sm)',
        'mercury-md': 'var(--mercury-radius-md)',
        'mercury-lg': 'var(--mercury-radius-lg)',
        'mercury-xl': 'var(--mercury-radius-xl)',
      },
    },
  },
  plugins: [],
} satisfies Config;


