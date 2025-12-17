"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type TimeRange = "today" | "7d" | "30d" | "90d" | "custom";

interface AnalyticsData {
  leadsByDay: Array<{ date: string; value: number }>;
  conversionByDay: Array<{ date: string; value: number }>;
  leadsByStatus: Array<{ status: string; count: number }>;
  leadsByTenant: Array<{ tenant: string; count: number }>;
  avgResponseTime: number;
  totalLeads: number;
  totalReady: number;
  totalDelivered: number;
  conversionRate: number;
}

export function useAnalytics(timeRange: TimeRange = "30d", customStart?: Date, customEnd?: Date) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Calculate date range
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      let startDate = new Date();

      if (timeRange === "custom" && customStart && customEnd) {
        startDate = customStart;
        endDate.setTime(customEnd.getTime());
      } else {
        const days = timeRange === "today" ? 0 : timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        startDate.setDate(startDate.getDate() - days);
      }

      startDate.setHours(0, 0, 0, 0);

      // Fetch leads by day
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const leadsByDay: Array<{ date: string; value: number }> = [];
      const conversionByDay: Array<{ date: string; value: number }> = [];

      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const [
          { count: totalLeads },
          { count: readyLeads },
          { count: deliveredLeads },
        ] = await Promise.all([
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .gte("created_at", date.toISOString())
            .lt("created_at", nextDay.toISOString()),
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .eq("status", "LEAD_READY")
            .gte("created_at", date.toISOString())
            .lt("created_at", nextDay.toISOString()),
          supabase
            .from("deliveries")
            .select("id", { count: "exact", head: true })
            .eq("status", "DELIVERED")
            .gte("delivered_at", date.toISOString())
            .lt("delivered_at", nextDay.toISOString()),
        ]);

        const dateLabel = date.toLocaleDateString("es-AR", { month: "short", day: "numeric" });
        leadsByDay.push({ date: dateLabel, value: totalLeads || 0 });
        conversionByDay.push({
          date: dateLabel,
          value: totalLeads ? Math.round(((deliveredLeads || 0) / totalLeads) * 100) : 0,
        });
      }

      // Fetch leads by status
      const { data: statusData } = await supabase
        .from("lead_offers")
        .select("status")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      const statusCounts: Record<string, number> = {};
      statusData?.forEach((l: any) => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });

      const leadsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));

      // Fetch leads by tenant
      const { data: tenantData } = await supabase
        .from("lead_offers")
        .select(`
          tenant_id,
          tenant:tenants(name)
        `)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      const tenantCounts: Record<string, { name: string; count: number }> = {};
      tenantData?.forEach((l: any) => {
        const tenantId = l.tenant_id;
        const tenantName = Array.isArray(l.tenant) ? l.tenant[0]?.name : l.tenant?.name || "Sin tenant";
        if (!tenantCounts[tenantId]) {
          tenantCounts[tenantId] = { name: tenantName, count: 0 };
        }
        tenantCounts[tenantId].count++;
      });

      const leadsByTenant = Object.values(tenantCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate average response time
      const { data: responseTimes } = await supabase
        .from("lead_offers")
        .select("created_at, first_response_at")
        .not("first_response_at", "is", null)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .limit(100);

      let avgResponseTime = 0;
      if (responseTimes && responseTimes.length > 0) {
        const times = responseTimes
          .map((r: any) => {
            const created = new Date(r.created_at).getTime();
            const responded = new Date(r.first_response_at).getTime();
            return (responded - created) / 1000 / 60; // minutes
          })
          .filter((t: number) => t > 0 && t < 1440);

        if (times.length > 0) {
          avgResponseTime = times.reduce((a: number, b: number) => a + b, 0) / times.length;
        }
      }

      // Get totals
      const [
        { count: totalLeads },
        { count: totalReady },
        { count: totalDelivered },
      ] = await Promise.all([
        supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .eq("status", "LEAD_READY")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        supabase
          .from("deliveries")
          .select("id", { count: "exact", head: true })
          .eq("status", "DELIVERED")
          .gte("delivered_at", startDate.toISOString())
          .lte("delivered_at", endDate.toISOString()),
      ]);

      setData({
        leadsByDay,
        conversionByDay,
        leadsByStatus,
        leadsByTenant,
        avgResponseTime,
        totalLeads: totalLeads || 0,
        totalReady: totalReady || 0,
        totalDelivered: totalDelivered || 0,
        conversionRate: totalLeads ? Math.round(((totalDelivered || 0) / totalLeads) * 100) : 0,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, timeRange, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, refetch: fetchData };
}
