"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================
// Theme Hook - Dark/Light Mode Management
// ============================================

export type Theme = "dark" | "light";

const THEME_KEY = "converzia-theme";

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
}

/**
 * Hook for managing theme (dark/light mode)
 * Persists to localStorage and applies to document element
 */
// Helper function to apply theme to DOM (defined outside component to avoid dependency issues)
function applyTheme(newTheme: Theme) {
  if (typeof document === "undefined") return;
  
  const root = document.documentElement;
  
  // Remove existing theme classes
  root.classList.remove("light", "dark");
  
  // Add new theme class (shadcn approach)
  root.classList.add(newTheme);
  
  // Also set data-theme attribute for CSS custom properties
  root.setAttribute("data-theme", newTheme);
  
  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      newTheme === "dark" ? "#0a0a0f" : "#ffffff"
    );
  }
}

export function useTheme(): UseThemeReturn {
  // Initialize with a safe default that matches SSR
  const [theme, setThemeState] = useState<Theme>(() => {
    // Only access localStorage on client side
    if (typeof window === "undefined") {
      return "dark";
    }
    
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) {
      return savedTheme;
    }
    
    // Fall back to system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });
  
  const [mounted, setMounted] = useState(false);

  // Apply theme immediately on mount
  useEffect(() => {
    setMounted(true);
    
    // Check localStorage first
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    
    let initialTheme: Theme;
    if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) {
      initialTheme = savedTheme;
    } else {
      // Fall back to system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      initialTheme = prefersDark ? "dark" : "light";
    }
    
    // Update state and apply theme
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for system theme changes (only if no saved preference)
  useEffect(() => {
    if (!mounted) return;
    
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) return; // Don't override user preference

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme: Theme = e.matches ? "dark" : "light";
      setThemeState(newTheme);
      applyTheme(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === "dark",
    isLight: theme === "light",
  };
}

/**
 * Server-side safe check for initial theme
 * Returns "dark" as default for SSR
 */
export function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }
  
  const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
  if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) {
    return savedTheme;
  }
  
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}














