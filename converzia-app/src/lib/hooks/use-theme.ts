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
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    setMounted(true);
    
    // Check localStorage first
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    
    if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Fall back to system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const systemTheme: Theme = prefersDark ? "dark" : "light";
      setThemeState(systemTheme);
      applyTheme(systemTheme);
    }
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

  const applyTheme = (newTheme: Theme) => {
    document.documentElement.setAttribute("data-theme", newTheme);
    
    // Also update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        newTheme === "dark" ? "#0a0a0f" : "#ffffff"
      );
    }
  };

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







