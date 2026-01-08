import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ============================================
// Class Name Utility
// ============================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// Formatting Utilities
// ============================================

export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "es-AR"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("es-AR", options).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (date === null || date === undefined) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  });
}

export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "hace un momento";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return formatDate(d);
}

// ============================================
// String Utilities
// ============================================

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ============================================
// Phone Utilities
// ============================================

export function formatPhone(phone: string): string {
  // Remove + if present
  const clean = phone.replace(/^\+/, "");

  // Format for Argentina
  if (clean.startsWith("54")) {
    const withoutCountry = clean.slice(2);
    if (withoutCountry.length === 10) {
      return `+54 ${withoutCountry.slice(0, 2)} ${withoutCountry.slice(2, 6)}-${withoutCountry.slice(6)}`;
    }
  }

  return phone;
}

export function normalizePhone(phone: string | null | undefined, defaultCountry = "54"): string {
  // Handle null/undefined/empty input
  if (!phone) return "";
  
  let normalized = phone.replace(/[^\d+]/g, "");
  
  // Handle empty result after stripping
  if (!normalized || normalized === "+") return "";

  // Remove leading + for processing
  if (normalized.startsWith("+")) {
    normalized = normalized.substring(1);
  }
  
  // Remove leading 00 (international prefix)
  if (normalized.startsWith("00")) {
    normalized = normalized.substring(2);
  }

  // Remove leading 0 (local prefix)
  if (normalized.startsWith("0")) {
    normalized = normalized.substring(1);
  }
  
  // For Argentine numbers, add country code and mobile prefix (9) if not present
  if (defaultCountry === "54") {
    // Already has full country code with mobile prefix (549)
    if (normalized.startsWith("549")) {
      return normalized;
    }
    // Has country code but no mobile prefix (54 without 9)
    if (normalized.startsWith("54") && !normalized.startsWith("549")) {
      // Insert 9 after 54 for mobile numbers
      return "549" + normalized.substring(2);
    }
    // Local number without country code - add 549
    return "549" + normalized;
  }
  
  // For other countries, just add country code if not present
  if (!normalized.startsWith(defaultCountry)) {
    normalized = defaultCountry + normalized;
  }

  return normalized;
}

/**
 * Normalized form for DB search/indexing.
 * Matches `leads.phone_normalized` generated by DB trigger: digits only, no leading "+".
 */
export function normalizePhoneForDb(phone: string | null | undefined, defaultCountry = "54"): string {
  // normalizePhone already returns without + prefix now
  return normalizePhone(phone, defaultCountry);
}

// ============================================
// Array Utilities
// ============================================

export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function uniqueBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortBy<T>(
  array: T[],
  keyFn: (item: T) => string | number,
  order: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return order === "desc" ? -comparison : comparison;
  });
}

// ============================================
// Object Utilities
// ============================================

export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

// ============================================
// URL Utilities
// ============================================

export function buildUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function parseQueryParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ============================================
// Async Utilities
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// Validation Utilities
// ============================================

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Color Utilities
// ============================================

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Tenant status
    PENDING: "warning",
    ACTIVE: "success",
    SUSPENDED: "danger",
    ARCHIVED: "secondary",
    // Lead status
    PENDING_MAPPING: "warning",
    TO_BE_CONTACTED: "info",
    CONTACTED: "info",
    ENGAGED: "primary",
    QUALIFYING: "primary",
    SCORED: "primary",
    LEAD_READY: "success",
    SENT_TO_DEVELOPER: "success",
    COOLING: "secondary",
    REACTIVATION: "warning",
    DISQUALIFIED: "danger",
    STOPPED: "danger",
    HUMAN_HANDOFF: "warning",
    // Delivery status
    DELIVERED: "success",
    FAILED: "danger",
    REFUNDED: "secondary",
  };

  return colors[status] || "default";
}

// ============================================
// Copy to Clipboard
// ============================================

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

// ============================================
// Download File
// ============================================

export function downloadFile(data: string, filename: string, type = "text/plain"): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const value = row[h];
        if (value === null || value === undefined) return "";
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
}

