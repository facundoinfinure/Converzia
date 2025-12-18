"use client";

import { ReactNode } from "react";
import { LightButton } from "@/components/ui/LightButton";
import { cn } from "@/lib/utils";

/**
 * QuickActions - Barra de acciones rápidas
 * Muestra botones de acción principales de forma prominente
 */
export interface QuickAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {actions.map((action, index) => (
        <LightButton
          key={index}
          variant={action.variant || "primary"}
          leftIcon={action.icon}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </LightButton>
      ))}
    </div>
  );
}
