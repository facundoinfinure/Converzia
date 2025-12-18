"use client";

import { useState } from "react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { LightButton } from "./LightButton";
import { LightCard } from "./LightCard";
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
    lead_ready: "bg-blue-100 text-blue-600",
    approval: "bg-purple-100 text-purple-600",
    delivery: "bg-green-100 text-green-600",
    low_credits: "bg-amber-100 text-amber-600",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
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
          <LightCard className="absolute top-full right-0 mt-2 w-96 z-50 max-h-[500px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <LightButton
                    size="sm"
                    variant="ghost"
                    onClick={markAllAsRead}
                    leftIcon={<CheckCheck className="h-4 w-4" />}
                  >
                    Marcar todas
                  </LightButton>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No hay notificaciones
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-gray-50 transition-colors",
                        !notification.read && "bg-blue-50/50"
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
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatRelativeTime(notification.timestamp.toISOString())}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </LightCard>
        </>
      )}
    </div>
  );
}
