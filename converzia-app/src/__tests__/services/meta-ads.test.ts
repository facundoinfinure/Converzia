/**
 * Meta Ads Service Tests
 * Tests the Meta (Facebook) Marketing API integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import {
  getAdAccounts,
  getCampaigns,
  getAdSets,
  getAds,
  getAdInsights,
  getCampaignStructure,
  type MetaAdAccount,
  type MetaCampaign,
  type MetaAdSet,
  type MetaAd,
  type MetaAdInsights,
} from "@/lib/services/meta-ads";

describe("Meta Ads Service", () => {
  const mockAccessToken = "test-access-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAdAccounts", () => {
    it("should fetch ad accounts successfully", async () => {
      const mockResponse: MetaAdAccount[] = [
        { id: "act_123", account_id: "123", name: "Test Account 1" },
        { id: "act_456", account_id: "456", name: "Test Account 2" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse }),
      });

      const result = await getAdAccounts(mockAccessToken);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Test Account 1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/me/adaccounts"),
        expect.anything()
      );
      // Verify access token is included in request
      expect(mockFetch.mock.calls[0][0]).toContain("access_token");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "Invalid access token" },
        }),
      });

      await expect(getAdAccounts(mockAccessToken)).rejects.toThrow(
        "Invalid access token"
      );
    });

    it("should return empty array when no accounts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await getAdAccounts(mockAccessToken);
      expect(result).toEqual([]);
    });
  });

  describe("getCampaigns", () => {
    const mockAccountId = "act_123";

    it("should fetch campaigns for an account", async () => {
      const mockCampaigns: MetaCampaign[] = [
        {
          id: "camp_1",
          name: "Test Campaign",
          status: "ACTIVE",
          objective: "LEAD_GENERATION",
          created_time: "2024-01-01T00:00:00Z",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCampaigns }),
      });

      const result = await getCampaigns(mockAccountId, mockAccessToken);

      expect(result).toHaveLength(1);
      expect(result[0].objective).toBe("LEAD_GENERATION");
    });

    it("should include campaign fields in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await getCampaigns(mockAccountId, mockAccessToken);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("fields="),
        expect.anything()
      );
    });
  });

  describe("getAdSets", () => {
    const mockAccountId = "act_123";

    it("should fetch ad sets for an account", async () => {
      const mockAdSets: MetaAdSet[] = [
        {
          id: "adset_1",
          name: "Test AdSet",
          status: "ACTIVE",
          campaign_id: "camp_1",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAdSets }),
      });

      const result = await getAdSets(mockAccountId, mockAccessToken);

      expect(result).toHaveLength(1);
      expect(result[0].campaign_id).toBe("camp_1");
    });
  });

  describe("getAds", () => {
    const mockAccountId = "act_123";

    it("should fetch ads for an account", async () => {
      const mockAds: MetaAd[] = [
        {
          id: "ad_1",
          name: "Test Ad",
          status: "ACTIVE",
          adset_id: "adset_1",
          campaign_id: "camp_1",
          created_time: "2024-01-01T00:00:00Z",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAds }),
      });

      const result = await getAds(mockAccountId, mockAccessToken);

      expect(result).toHaveLength(1);
      expect(result[0].adset_id).toBe("adset_1");
    });
  });

  describe("getAdInsights", () => {
    const mockAccountId = "act_123";

    it("should fetch ad insights with date range", async () => {
      const mockInsights: MetaAdInsights[] = [
        {
          ad_id: "ad_1",
          ad_name: "Test Ad",
          campaign_id: "camp_1",
          campaign_name: "Test Campaign",
          adset_id: "adset_1",
          adset_name: "Test AdSet",
          impressions: 1000,
          clicks: 50,
          spend: 100.5,
          date_start: "2024-01-01",
          date_stop: "2024-01-31",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockInsights }),
      });

      const result = await getAdInsights(
        mockAccountId,
        mockAccessToken,
        "2024-01-01",
        "2024-01-31"
      );

      expect(result).toHaveLength(1);
      expect(result[0].spend).toBe(100.5);
      expect(result[0].impressions).toBe(1000);
    });

    it("should include date range in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await getAdInsights(mockAccountId, mockAccessToken, "2024-01-01", "2024-01-31");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("time_range"),
        expect.anything()
      );
    });
  });

  describe("getCampaignStructure", () => {
    const mockAccountId = "act_123";

    it("should fetch complete campaign structure", async () => {
      // Mock campaigns
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "camp_1", name: "Campaign 1", status: "ACTIVE", objective: "LEADS", created_time: "" }],
        }),
      });

      // Mock adsets
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "adset_1", name: "AdSet 1", status: "ACTIVE", campaign_id: "camp_1" }],
        }),
      });

      // Mock ads
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "ad_1", name: "Ad 1", status: "ACTIVE", adset_id: "adset_1", campaign_id: "camp_1", created_time: "" }],
        }),
      });

      const result = await getCampaignStructure(mockAccountId, mockAccessToken);

      expect(result.campaigns).toHaveLength(1);
      expect(result.adsets).toHaveLength(1);
      expect(result.ads).toHaveLength(1);
    });
  });

  describe("Error Handling", () => {
    it("should throw on network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(getAdAccounts(mockAccessToken)).rejects.toThrow("Network error");
    });

    it("should handle rate limiting errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "Rate limit exceeded", code: 17 },
        }),
      });

      await expect(getAdAccounts(mockAccessToken)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should handle expired token errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "Token expired", code: 190 },
        }),
      });

      await expect(getAdAccounts(mockAccessToken)).rejects.toThrow(
        "Token expired"
      );
    });
  });
});
