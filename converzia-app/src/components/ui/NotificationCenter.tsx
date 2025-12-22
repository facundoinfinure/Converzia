"use client";

import { useState } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { useNotifications, Notification } from "@/lib/hooks/use-notifications";
import { formatRelativeTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
    setIsOpen(false);
  };

  const notificationIcons = {
    lead_ready: "🎯",
    approval: "👤",
    delivery: "✅",
    low_credits: "⚠️",
  };

  const notificationColors = {
    lead_ready: "bg-[var(--info-light)] text-[var(--info)]",
    approval: "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]",
    delivery: "bg-[var(--success-light)] text-[var(--success)]",
    low_credits: "bg-[var(--warning-light)] text-[var(--warning)]",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute top-full right-0 mt-2 w-96 z-50 max-h-[500px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={markAllAsRead}
                    leftIcon={<CheckCheck className="h-4 w-4" />}
                  >
                    Marcar todas
                  </Button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-tertiary)]">
                  No hay notificaciones
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-primary)]">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-[var(--bg-tertiary)] transition-colors",
                        !notification.read && "bg-[var(--accent-primary-light)]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center text-lg",
                            notificationColors[notification.type]
                          )}
                        >
                          {notificationIcons[notification.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {notification.title}
                          </p>
                          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)] mt-1">
                            {formatRelativeTime(notification.timestamp.toISOString())}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
