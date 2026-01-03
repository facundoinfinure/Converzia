"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";

// ============================================
// Theme Toggle Component - Clean, Modern Design
// ============================================

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * Toggle button for switching between dark and light themes
 */
export function ThemeToggle({ 
  className, 
  size = "md",
  showLabel = false 
}: ThemeToggleProps) {
  const { toggleTheme, isDark } = useTheme();

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-5 w-5",
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center justify-center rounded-lg transition-all duration-200",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        "hover:bg-[var(--bg-tertiary)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2",
        sizeClasses[size],
        className
      )}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {/* Sun icon (shown in dark mode, clicking switches to light) */}
      <Sun
        className={cn(
          iconSizes[size],
          "absolute transition-all duration-300",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0"
        )}
      />
      
      {/* Moon icon (shown in light mode, clicking switches to dark) */}
      <Moon
        className={cn(
          iconSizes[size],
          "absolute transition-all duration-300",
          isDark
            ? "-rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        )}
      />

      {showLabel && (
        <span className="ml-8 text-sm">
          {isDark ? "Claro" : "Oscuro"}
        </span>
      )}
    </button>
  );
}

/**
 * Theme toggle for settings page with full description
 */
interface ThemeSettingProps {
  className?: string;
}

export function ThemeSetting({ className }: ThemeSettingProps) {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <p className="font-medium text-[var(--text-primary)]">Tema de la aplicación</p>
        <p className="text-sm text-[var(--text-secondary)]">
          {isDark 
            ? "Modo oscuro activo - ideal para ambientes con poca luz" 
            : "Modo claro activo - ideal para ambientes iluminados"}
        </p>
      </div>
      
      <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
        <button
          onClick={() => setTheme("light")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
            theme === "light"
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <Sun className="h-4 w-4" />
          Claro
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
            theme === "dark"
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <Moon className="h-4 w-4" />
          Oscuro
        </button>
      </div>
    </div>
  );
}














