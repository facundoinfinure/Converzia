"use client";

import { ReactNode, useState } from "react";
import { LucideIcon, MoreVertical } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
  DrawerClose,
} from "./drawer";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

// ============================================
// ActionDrawer - Bottom sheet for actions
// Uses shadcn Drawer (vaul) for native gestures
// ============================================

export interface ActionDrawerItem {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  description?: string;
}

export interface ActionDrawerSection {
  title?: string;
  items: ActionDrawerItem[];
}

interface ActionDrawerProps {
  trigger?: ReactNode;
  title?: string;
  description?: string;
  items?: ActionDrawerItem[];
  sections?: ActionDrawerSection[];
  className?: string;
}

export function ActionDrawer({
  trigger,
  title = "Acciones",
  description,
  items,
  sections,
  className,
}: ActionDrawerProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (action: () => void) => {
    setOpen(false);
    // Small delay to let drawer close animation play
    setTimeout(action, 150);
  };

  const renderItem = (item: ActionDrawerItem, index: number) => {
    const Icon = item.icon;
    
    return (
      <button
        key={index}
        onClick={() => handleAction(item.onPress)}
        disabled={item.disabled}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left",
          "transition-colors duration-150",
          "active:scale-[0.98]",
          item.variant === "destructive"
            ? "text-destructive hover:bg-destructive/10 active:bg-destructive/20"
            : "text-foreground hover:bg-muted active:bg-muted/80",
          item.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {Icon && (
          <Icon className={cn(
            "h-5 w-5 flex-shrink-0",
            item.variant === "destructive" ? "text-destructive" : "text-muted-foreground"
          )} />
        )}
        <div className="flex-1 min-w-0">
          <span className="font-medium">{item.label}</span>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
          )}
        </div>
      </button>
    );
  };

  const renderSection = (section: ActionDrawerSection, sectionIndex: number) => (
    <div key={sectionIndex} className={cn(sectionIndex > 0 && "mt-4 pt-4 border-t border-border")}>
      {section.title && (
        <p className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {section.title}
        </p>
      )}
      <div className="space-y-1">
        {section.items.map((item, i) => renderItem(item, i))}
      </div>
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        )}
      </DrawerTrigger>
      
      <DrawerContent className={cn("pb-safe", className)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && (
            <DrawerDescription>{description}</DrawerDescription>
          )}
        </DrawerHeader>
        
        <div className="px-2 pb-6">
          {/* Render sections if provided */}
          {sections?.map((section, i) => renderSection(section, i))}
          
          {/* Render flat items if no sections */}
          {!sections && items && (
            <div className="space-y-1">
              {items.map((item, i) => renderItem(item, i))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ============================================
// ResponsiveActionMenu - Dropdown or Drawer
// Desktop: DropdownMenu
// Mobile: ActionDrawer
// ============================================

import { useIsMobile } from "@/lib/hooks/use-mobile";
import { ActionDropdown } from "./Dropdown";

interface ResponsiveActionMenuProps {
  items: Array<{
    label: string;
    icon?: LucideIcon | ReactNode;
    onClick?: () => void;
    danger?: boolean;
    divider?: boolean;
    disabled?: boolean;
  }>;
  trigger?: ReactNode;
  title?: string;
}

export function ResponsiveActionMenu({
  items,
  trigger,
  title = "Acciones",
}: ResponsiveActionMenuProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    // Convert items to ActionDrawer format
    const sections: ActionDrawerSection[] = [];
    let currentSection: ActionDrawerItem[] = [];
    
    items.forEach((item, index) => {
      if (item.divider && currentSection.length > 0) {
        sections.push({ items: currentSection });
        currentSection = [];
      } else if (!item.divider && item.onClick) {
        currentSection.push({
          label: item.label,
          icon: item.icon,
          onPress: item.onClick,
          variant: item.danger ? "destructive" : "default",
          disabled: item.disabled,
        });
      }
      
      // Push remaining items at the end
      if (index === items.length - 1 && currentSection.length > 0) {
        sections.push({ items: currentSection });
      }
    });

    return (
      <ActionDrawer
        trigger={trigger}
        title={title}
        sections={sections.length > 1 ? sections : undefined}
        items={sections.length === 1 ? sections[0].items : undefined}
      />
    );
  }

  // Desktop: use existing ActionDropdown - convert icons to ReactNode
  const dropdownItems = items.map(item => ({
    ...item,
    icon: item.icon && typeof item.icon === 'function' 
      ? <item.icon className="h-4 w-4" /> 
      : item.icon,
  }));
  return <ActionDropdown items={dropdownItems} />;
}

// ============================================
// ConfirmDrawer - Confirmation bottom sheet
// ============================================

interface ConfirmDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ConfirmDrawer({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDrawerProps) {
  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 pb-6 flex flex-col gap-2">
          <Button
            onClick={handleConfirm}
            variant={variant === "destructive" ? "danger" : "primary"}
            isLoading={isLoading}
            className="w-full"
          >
            {confirmLabel}
          </Button>
          <Button
            onClick={handleCancel}
            variant="ghost"
            disabled={isLoading}
            className="w-full"
          >
            {cancelLabel}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

