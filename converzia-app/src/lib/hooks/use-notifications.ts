"use client";

import { useState, useEffect, useCallback } from "react";
import { realtimeService } from "@/lib/services/realtime";
import { useAuth } from "@/lib/auth/context";

export interface Notification {
  id: string;
  type: "lead_ready" | "approval" | "delivery" | "low_credits";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export function useNotifications() {
  const { activeTenantId, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "read" | "timestamp">) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50
    setUnreadCount((prev) => prev + 1);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Subscribe to real-time events
  useEffect(() => {
    if (!activeTenantId) return;

    // Subscribe to new leads ready
    const unsubscribeLeads = realtimeService.subscribeToLeads(
      activeTenantId,
      (payload) => {
        if (payload.eventType === "INSERT" && payload.new.status === "LEAD_READY") {
          addNotification({
            type: "lead_ready",
            title: "Nuevo Lead Ready",
            message: `Un nuevo lead está listo para entrega`,
            actionUrl: "/portal/offers",
          });
        }
      }
    );

    // Subscribe to deliveries
    const unsubscribeDeliveries = realtimeService.subscribeToDeliveries(
      activeTenantId,
      (payload) => {
        if (payload.eventType === "INSERT" && payload.new.status === "DELIVERED") {
          addNotification({
            type: "delivery",
            title: "Lead Entregado",
            message: `Un lead ha sido entregado exitosamente`,
            actionUrl: "/portal/offers",
          });
        }
      }
    );

    return () => {
      unsubscribeLeads();
      unsubscribeDeliveries();
    };
  }, [activeTenantId, addNotification]);

  // Subscribe to approvals (admin only)
  useEffect(() => {
    const unsubscribeApprovals = realtimeService.subscribeToApprovals((payload) => {
      if (payload.eventType === "INSERT") {
        addNotification({
          type: "approval",
          title: "Nueva Solicitud de Aprobación",
          message: `Hay una nueva solicitud de acceso pendiente`,
          actionUrl: "/admin/users",
        });
      }
    });

    return unsubscribeApprovals;
  }, [addNotification]);

  // Subscribe to tenant approval status changes (for users waiting approval)
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribeStatus = realtimeService.subscribeToTenantStatus(user.id, (payload) => {
      const tenantName = payload.new?.tenant?.name || "tu tenant";
      addNotification({
        type: "approval",
        title: "¡Tu solicitud fue aprobada!",
        message: `Tu acceso a ${tenantName} ha sido aprobado. Ya podés acceder al portal.`,
        actionUrl: "/portal",
      });
    });

    return unsubscribeStatus;
  }, [user?.id, addNotification]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
  };
}
