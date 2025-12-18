"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Tabs Context
// ============================================

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

// ============================================
// Tabs Root
// ============================================

interface TabsProps {
  defaultValue: string;
  value?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (newValue: string) => {
    if (!value) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// ============================================
// Tabs List
// ============================================

interface TabsListProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "pills" | "underline";
}

export function TabsList({ children, className, variant = "default" }: TabsListProps) {
  const variants = {
    default: "flex gap-1 p-1 bg-card rounded-lg border border-card-border",
    pills: "flex gap-2",
    underline: "flex gap-6 border-b border-card-border",
  };

  return (
    <div className={cn(variants[variant], className)} role="tablist">
      {children}
    </div>
  );
}

// ============================================
// Tab Trigger
// ============================================

interface TabTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  count?: number;
}

export function TabTrigger({
  value,
  children,
  className,
  disabled = false,
  icon,
  count,
}: TabTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-background",
        isActive
          ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
          : "text-slate-400 hover:text-white hover:bg-card-border",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {icon && <span className="h-4 w-4">{icon}</span>}
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "ml-1 px-1.5 py-0.5 text-xs rounded-md",
            isActive
              ? "bg-primary-500/30 text-primary-300"
              : "bg-slate-700 text-slate-400"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================
// Tab Content
// ============================================

interface TabContentProps {
  value: string;
  children: ReactNode;
  className?: string;
  forceMount?: boolean;
}

export function TabContent({
  value,
  children,
  className,
  forceMount = false,
}: TabContentProps) {
  const { activeTab } = useTabs();
  const isActive = activeTab === value;

  if (!isActive && !forceMount) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={!isActive}
      className={cn("mt-4 focus:outline-none", className)}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

// ============================================
// Vertical Tabs
// ============================================

interface VerticalTabsProps {
  defaultValue: string;
  value?: string;
  onChange?: (value: string) => void;
  tabs: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
    count?: number;
    disabled?: boolean;
  }>;
  children: ReactNode;
  className?: string;
}

export function VerticalTabs({
  defaultValue,
  value,
  onChange,
  tabs,
  children,
  className,
}: VerticalTabsProps) {
  return (
    <Tabs defaultValue={defaultValue} value={value} onChange={onChange}>
      <div className={cn("flex gap-6", className)}>
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <TabTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
                icon={tab.icon}
                count={tab.count}
                className="w-full justify-start"
              >
                {tab.label}
              </TabTrigger>
            ))}
          </nav>
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </Tabs>
  );
}


