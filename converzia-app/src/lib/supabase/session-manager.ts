"use client";

import { createClient } from "./client";

/**
 * Session Manager for Supabase
 * Handles session refresh and validation
 */
export class SessionManager {
  private supabase = createClient();
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  /**
   * Check if current session is valid
   */
  async checkSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error("Session check error:", error);
        return false;
      }

      if (!session) {
        return false;
      }

      // Check if session is expired or about to expire (within 5 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
        return expiresIn > 300; // 5 minutes
      }

      return true;
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<boolean> {
    if (this.isRefreshing) {
      return false; // Already refreshing
    }

    this.isRefreshing = true;
    try {
      const { data: { session }, error } = await this.supabase.auth.refreshSession();

      if (error) {
        console.error("Session refresh error:", error);
        this.isRefreshing = false;
        return false;
      }

      if (!session) {
        console.warn("No session after refresh");
        this.isRefreshing = false;
        return false;
      }

      console.log("✅ Session refreshed successfully");
      this.isRefreshing = false;
      return true;
    } catch (error) {
      console.error("Error refreshing session:", error);
      this.isRefreshing = false;
      return false;
    }
  }

  /**
   * Start automatic session refresh
   */
  startAutoRefresh(intervalMs: number = 5 * 60 * 1000): void {
    // Clear existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Refresh session every 5 minutes
    this.refreshInterval = setInterval(async () => {
      const isValid = await this.checkSession();
      if (!isValid) {
        console.log("🔄 Auto-refreshing session...");
        await this.refreshSession();
      }
    }, intervalMs);
  }

  /**
   * Stop automatic session refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error) {
        console.error("Error getting user:", error);
        return null;
      }
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }
}

export const sessionManager = new SessionManager();






