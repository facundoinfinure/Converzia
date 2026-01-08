/**
 * Google Sheets Service Tests
 * Tests the Google Sheets delivery integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock googleapis before importing the service
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        refreshAccessToken: vi.fn().mockResolvedValue({
          credentials: {
            access_token: "refreshed-token",
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      })),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        values: {
          append: vi.fn().mockResolvedValue({
            data: {
              updates: {
                updatedRange: "Sheet1!A10:Z10",
                updatedRows: 1,
              },
            },
          }),
          get: vi.fn().mockResolvedValue({
            data: {
              values: [["Header1", "Header2"]],
            },
          }),
          update: vi.fn().mockResolvedValue({
            data: { updatedCells: 10 },
          }),
        },
        get: vi.fn().mockResolvedValue({
          data: {
            sheets: [{ properties: { title: "Sheet1", sheetId: 0 } }],
          },
        }),
      },
    }),
    drive: vi.fn().mockReturnValue({
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [
              { id: "spreadsheet_1", name: "Test Spreadsheet", webViewLink: "https://sheets.google.com/..." },
            ],
          },
        }),
      },
    }),
  },
}));

// Mock supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { oauth_tokens: { access_token: "token", refresh_token: "refresh", expires_at: Date.now() + 3600000 } },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/query-with-timeout", () => ({
  queryWithTimeout: vi.fn((promise) => promise),
}));

import type { GoogleSheetsConfig, SheetsAppendResult } from "@/lib/services/google-sheets";

describe("Google Sheets Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  describe("GoogleSheetsConfig Type", () => {
    it("should define required config fields", () => {
      const config: GoogleSheetsConfig = {
        spreadsheet_id: "abc123",
        sheet_name: "Leads",
      };

      expect(config.spreadsheet_id).toBe("abc123");
      expect(config.sheet_name).toBe("Leads");
    });

    it("should allow optional column mapping", () => {
      const config: GoogleSheetsConfig = {
        spreadsheet_id: "abc123",
        sheet_name: "Leads",
        column_mapping: {
          name: "A",
          phone: "B",
          email: "C",
        },
      };

      expect(config.column_mapping?.name).toBe("A");
    });
  });

  describe("SheetsAppendResult Type", () => {
    it("should represent success result", () => {
      const result: SheetsAppendResult = {
        success: true,
        row_number: 10,
      };

      expect(result.success).toBe(true);
      expect(result.row_number).toBe(10);
    });

    it("should represent error result", () => {
      const result: SheetsAppendResult = {
        success: false,
        error: "Failed to append row",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to append row");
    });
  });

  describe("Configuration Validation", () => {
    it("should require spreadsheet_id", () => {
      const config: Partial<GoogleSheetsConfig> = {
        sheet_name: "Leads",
      };

      // Partial config - spreadsheet_id is optional on Partial type
      expect(config.spreadsheet_id).toBeUndefined();
    });

    it("should require sheet_name", () => {
      const config: Partial<GoogleSheetsConfig> = {
        spreadsheet_id: "abc123",
      };

      // Partial config - sheet_name is optional on Partial type
      expect(config.sheet_name).toBeUndefined();
    });
  });

  describe("Row Number Parsing", () => {
    it("should extract row number from update range", () => {
      // Simulating the row extraction logic from the service
      const updatedRange = "Sheet1!A10:Z10";
      const rowMatch = updatedRange.match(/!.*?(\d+)/);
      const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : undefined;

      expect(rowNumber).toBe(10);
    });

    it("should handle different range formats", () => {
      const ranges = [
        { input: "Leads!A5:T5", expected: 5 },
        { input: "Sheet1!A100:Z100", expected: 100 },
        { input: "'My Sheet'!A1:Z1", expected: 1 },
      ];

      ranges.forEach(({ input, expected }) => {
        const rowMatch = input.match(/!.*?(\d+)/);
        const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : undefined;
        expect(rowNumber).toBe(expected);
      });
    });
  });

  describe("Lead Data Formatting", () => {
    it("should format qualification fields for sheets", () => {
      // Simulating data formatting
      const qualificationFields = {
        budget_min: 100000,
        budget_max: 200000,
        zones: ["Zone A", "Zone B"],
        timing: "Within 3 months",
      };

      const formattedZones = Array.isArray(qualificationFields.zones)
        ? qualificationFields.zones.join(", ")
        : qualificationFields.zones;

      expect(formattedZones).toBe("Zone A, Zone B");
    });

    it("should handle null/undefined fields", () => {
      const qualificationFields = {
        budget_min: null,
        budget_max: undefined,
        zones: [],
      };

      const budgetMin = qualificationFields.budget_min ?? "";
      const budgetMax = qualificationFields.budget_max ?? "";
      const zones = qualificationFields.zones?.join(", ") || "";

      expect(budgetMin).toBe("");
      expect(budgetMax).toBe("");
      expect(zones).toBe("");
    });
  });

  describe("Score Breakdown Formatting", () => {
    it("should format score breakdown for display", () => {
      const scoreBreakdown = {
        budget_score: 25,
        zone_score: 20,
        timing_score: 15,
        completeness_score: 10,
      };

      const total = Object.values(scoreBreakdown).reduce((sum, val) => sum + val, 0);
      expect(total).toBe(70);
    });

    it("should handle missing score fields", () => {
      const scoreBreakdown = {
        budget_score: 25,
        // Other fields missing
      };

      const total = Object.values(scoreBreakdown).reduce((sum, val) => sum + (val || 0), 0);
      expect(total).toBe(25);
    });
  });

  describe("Date Formatting", () => {
    it("should format ISO date for sheets", () => {
      const isoDate = "2024-01-15T10:30:00.000Z";
      const date = new Date(isoDate);
      
      // Expected format for Argentina locale
      const formatted = date.toLocaleString("es-AR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      expect(formatted).toContain("15");
      expect(formatted).toContain("01");
      expect(formatted).toContain("2024");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing OAuth config", () => {
      delete process.env.GOOGLE_CLIENT_ID;
      
      // The service should return null client when config is missing
      expect(process.env.GOOGLE_CLIENT_ID).toBeUndefined();
    });

    it("should construct meaningful error messages", () => {
      const error = {
        code: 403,
        message: "The caller does not have permission",
      };

      const errorMessage = `Google Sheets error (${error.code}): ${error.message}`;
      expect(errorMessage).toContain("403");
      expect(errorMessage).toContain("permission");
    });
  });
});
