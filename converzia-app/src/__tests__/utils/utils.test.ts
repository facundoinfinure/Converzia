import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  cn,
  truncate,
} from "@/lib/utils";

describe("Utils", () => {
  describe("normalizePhone", () => {
    it("should normalize Argentine phone numbers", () => {
      expect(normalizePhone("11-1234-5678")).toBe("5491112345678");
      expect(normalizePhone("1512345678")).toBe("5491512345678");
    });

    it("should handle phones with country code", () => {
      expect(normalizePhone("+5491112345678")).toBe("5491112345678");
      expect(normalizePhone("005491112345678")).toBe("5491112345678");
    });

    it("should remove special characters", () => {
      expect(normalizePhone("11-1234-5678")).toBe("5491112345678");
      expect(normalizePhone("(11) 1234-5678")).toBe("5491112345678");
      expect(normalizePhone("11.1234.5678")).toBe("5491112345678");
    });

    it("should handle empty input", () => {
      expect(normalizePhone("")).toBe("");
      expect(normalizePhone(null as unknown as string)).toBe("");
      expect(normalizePhone(undefined as unknown as string)).toBe("");
    });

    it("should handle phones starting with 15", () => {
      expect(normalizePhone("1512345678")).toBe("5491512345678");
    });
  });

  describe("formatCurrency", () => {
    it("should format USD amounts", () => {
      const result = formatCurrency(1000, "USD");
      expect(result).toContain("1");
      expect(result).toContain("000");
    });

    it("should format ARS amounts", () => {
      const result = formatCurrency(1000, "ARS");
      expect(result).toContain("1");
      expect(result).toContain("000");
    });

    it("should handle zero", () => {
      const result = formatCurrency(0, "USD");
      expect(result).toContain("0");
    });

    it("should handle negative numbers", () => {
      const result = formatCurrency(-500, "USD");
      expect(result).toContain("500");
    });
  });

  describe("formatDate", () => {
    it("should format ISO date strings", () => {
      const result = formatDate("2024-01-15T10:30:00Z");
      expect(result).toBeTruthy();
    });

    it("should format Date objects", () => {
      const date = new Date(2024, 0, 15);
      const result = formatDate(date);
      expect(result).toBeTruthy();
    });

    it("should handle null/undefined", () => {
      expect(formatDate(null as unknown as string)).toBe("");
      expect(formatDate(undefined as unknown as string)).toBe("");
    });
  });

  describe("formatRelativeTime", () => {
    it("should show relative time for recent dates", () => {
      const recentDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const result = formatRelativeTime(recentDate);
      expect(result).toBeTruthy();
    });

    it("should show relative time for hours ago", () => {
      const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const result = formatRelativeTime(hoursAgo);
      expect(result).toBeTruthy();
    });
  });

  describe("cn (classnames)", () => {
    it("should merge class names", () => {
      const result = cn("foo", "bar");
      expect(result).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      const result = cn("base", true && "active", false && "hidden");
      expect(result).toBe("base active");
    });

    it("should handle undefined/null", () => {
      const result = cn("base", undefined, null, "end");
      expect(result).toBe("base end");
    });

    it("should merge Tailwind classes correctly", () => {
      const result = cn("px-4 py-2", "px-6");
      expect(result).toContain("px-6");
      expect(result).not.toContain("px-4");
    });
  });

  describe("truncate", () => {
    it("should truncate long strings", () => {
      const result = truncate("This is a very long string that should be truncated", 20);
      expect(result.length).toBeLessThanOrEqual(23); // 20 + "..."
      expect(result).toContain("...");
    });

    it("should not truncate short strings", () => {
      const result = truncate("Short", 20);
      expect(result).toBe("Short");
    });

    it("should handle empty strings", () => {
      expect(truncate("", 10)).toBe("");
    });
  });

  describe("pluralize helper", () => {
    // Simple pluralize helper for testing
    const pluralize = (count: number, singular: string, plural: string) => 
      count === 1 ? singular : plural;

    it("should return singular for count of 1", () => {
      expect(pluralize(1, "lead", "leads")).toBe("lead");
    });

    it("should return plural for count > 1", () => {
      expect(pluralize(5, "lead", "leads")).toBe("leads");
    });

    it("should return plural for count of 0", () => {
      expect(pluralize(0, "lead", "leads")).toBe("leads");
    });
  });
});
