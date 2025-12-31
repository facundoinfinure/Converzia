import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ============================================
// Page Header Component - Mobile-First Design
// ============================================

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  compact = false,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 lg:mb-8 animate-fadeInUp", className)}>
      {/* Breadcrumbs - Hide on mobile for cleaner UI */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="hidden sm:flex items-center gap-1.5 text-sm mb-3">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-[var(--text-secondary)] font-medium">
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Title and Actions - Stack on mobile */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 
            className={cn(
              "font-bold text-[var(--text-primary)] tracking-tight",
              "font-[var(--font-display)]",
              compact 
                ? "text-xl lg:text-2xl" 
                : "text-2xl lg:text-3xl"
            )}
          >
            {title}
          </h1>
          {description && (
            <p className={cn(
              "text-[var(--text-secondary)] mt-1",
              compact ? "text-sm" : "text-sm lg:text-base"
            )}>
              {description}
            </p>
          )}
        </div>

        {/* Actions - Full width on small mobile, auto on larger */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Section Header (for card sections)
// ============================================

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] font-[var(--font-display)]">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ============================================
// Page Container - Mobile-First
// ============================================

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

export function PageContainer({
  children,
  className,
  maxWidth = "full",
}: PageContainerProps) {
  const maxWidths = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
    xl: "max-w-6xl",
    "2xl": "max-w-7xl",
    full: "",
  };

  return (
    <div 
      className={cn(
        // Mobile-first padding
        "px-4 py-5",
        // Larger padding on desktop
        "sm:px-6 lg:px-8 lg:py-6",
        // Max width
        maxWidths[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// Mobile Page Title (for simple mobile headers)
// ============================================

interface MobileTitleProps {
  title: string;
  backHref?: string;
  actions?: ReactNode;
  className?: string;
}

export function MobileTitle({
  title,
  backHref,
  actions,
  className,
}: MobileTitleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-4 px-4 lg:hidden",
        "border-b border-[var(--border-primary)] bg-[var(--bg-primary)]",
        "sticky top-0 z-20",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Link>
        )}
        <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}


