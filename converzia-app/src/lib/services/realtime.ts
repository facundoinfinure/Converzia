"use client";

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Realtime service for Supabase subscriptions
 * Provides real-time updates for leads, approvals, and other events
 */
export class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private supabase: ReturnType<typeof createClient> = createClient();

  /**
   * Subscribe to lead_offers changes
   */
  subscribeToLeads(
    tenantId: string | null,
    callback: (payload: any) => void
  ): () => void {
    const channelName = `leads:${tenantId || "all"}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lead_offers",
          ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
        },
        callback
      )
      .subscribe();
    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to tenant_members changes (for approvals)
   */
  subscribeToApprovals(callback: (payload: any) => void): () => void {
    const channelName = "approvals";

    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tenant_members",
          filter: "status=eq.PENDING_APPROVAL",
        },
        callback
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to tenant status changes (for approval notifications)
   */
  subscribeToTenantStatus(
    userId: string,
    callback: (payload: any) => void
  ): () => void {
    const channelName = `tenant-status:${userId}`;

    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tenant_members",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Only trigger for status changes to ACTIVE
          if (payload.new?.status === "ACTIVE" && payload.old?.status !== "ACTIVE") {
            callback(payload);
          }
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to deliveries changes
   */
  subscribeToDeliveries(
    tenantId: string | null,
    callback: (payload: any) => void
  ): () => void {
    const channelName = `deliveries:${tenantId || "all"}`;

    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
          ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
        },
        callback
      )
      .subscribe();
    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup() {
    this.channels.forEach((channel) => channel.unsubscribe());
    this.channels.clear();
  }
}

export const realtimeService = new RealtimeService();
