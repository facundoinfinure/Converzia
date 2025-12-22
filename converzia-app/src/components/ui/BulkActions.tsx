"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  icon?: ReactNode;
  onClick: (selectedIds: string[]) => void;
  variant?: "primary" | "secondary" | "danger";
  confirmMessage?: string;
}

interface BulkActionsProps {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}

export function BulkActions({ selectedCount, selectedIds, actions, onClear, className }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-xl",
        "px-4 py-3 flex items-center gap-3",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {selectedCount} seleccionado{selectedCount > 1 ? "s" : ""}
        </span>
        <button
          onClick={onClear}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-6 w-px bg-[var(--border-primary)]" />

      <div className="flex items-center gap-2">
        {actions.map((action, idx) => (
          <Button
            key={idx}
            size="sm"
            variant={action.variant || "secondary"}
            leftIcon={action.icon}
            onClick={() => {
              if (action.confirmMessage) {
                if (confirm(action.confirmMessage)) {
                  action.onClick(selectedIds);
                }
              } else {
                action.onClick(selectedIds);
              }
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
