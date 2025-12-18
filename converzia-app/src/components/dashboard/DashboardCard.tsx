"use client";

import { ReactNode } from "react";
import { LightCard, LightCardHeader, LightCardTitle, LightCardContent, LightCardFooter } from "@/components/ui/LightCard";
import { LightButton } from "@/components/ui/LightButton";
import { cn } from "@/lib/utils";

/**
 * DashboardCard - Card component para dashboards
 * Incluye título, descripción, métricas y CTA
 */
export interface DashboardCardProps {
  title: string;
  description?: string;
  value?: string | number;
  change?: {
    value: number;
    label?: string;
    trend?: "up" | "down" | "neutral";
  };
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "outline";
  };
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function DashboardCard({
  title,
  description,
  value,
  change,
  action,
  children,
  className,
  footer,
}: DashboardCardProps) {
  const changeColor = change?.trend === "up" 
    ? "text-green-600" 
    : change?.trend === "down" 
    ? "text-red-600" 
    : "text-gray-600";

  return (
    <LightCard className={cn("", className)}>
      <LightCardHeader>
        <div>
          <LightCardTitle>{title}</LightCardTitle>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
      </LightCardHeader>
      
      <LightCardContent>
        {value !== undefined && (
          <div className="mb-4">
            <div className="text-3xl font-bold text-gray-900">{value}</div>
            {change && (
              <div className={cn("text-sm mt-1", changeColor)}>
                {change.trend === "up" && "+"}
                {change.trend === "down" && "-"}
                {Math.abs(change.value)}
                {change.label && ` ${change.label}`}
              </div>
            )}
          </div>
        )}
        {children}
      </LightCardContent>

      {(action || footer) && (
        <LightCardFooter>
          {footer || (
            action && (
              <LightButton
                variant={action.variant || "secondary"}
                onClick={action.onClick}
                size="sm"
              >
                {action.label}
              </LightButton>
            )
          )}
        </LightCardFooter>
      )}
    </LightCard>
  );
}
