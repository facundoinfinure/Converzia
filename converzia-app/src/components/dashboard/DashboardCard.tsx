"use client";

import { ReactNode } from "react";
import { MercuryCard, MercuryCardHeader, MercuryCardTitle, MercuryCardContent, MercuryCardFooter } from "@/components/ui/MercuryCard";
import { MercuryButton } from "@/components/ui/MercuryButton";
import { cn } from "@/lib/utils";

/**
 * DashboardCard - Card component para dashboards estilo Mercury
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
    <MercuryCard className={cn("", className)}>
      <MercuryCardHeader>
        <div>
          <MercuryCardTitle>{title}</MercuryCardTitle>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
      </MercuryCardHeader>
      
      <MercuryCardContent>
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
      </MercuryCardContent>

      {(action || footer) && (
        <MercuryCardFooter>
          {footer || (
            action && (
              <MercuryButton
                variant={action.variant || "secondary"}
                onClick={action.onClick}
                size="sm"
              >
                {action.label}
              </MercuryButton>
            )
          )}
        </MercuryCardFooter>
      )}
    </MercuryCard>
  );
}
