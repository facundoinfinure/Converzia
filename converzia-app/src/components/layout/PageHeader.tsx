import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ============================================
// Page Header Component - shadcn compatible
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
    <div className={cn("mb-6 lg:mb-8 animate-fade-in-up", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 1 && (
        <nav className="hidden lg:flex items-center gap-1.5 text-xs mb-3 text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3 w-3" />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground">
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Title and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 
            className={cn(
              "font-bold text-foreground tracking-tight",
              compact 
                ? "text-lg lg:text-xl" 
                : "text-xl lg:text-2xl"
            )}
          >
            {title}
          </h1>
          {description && (
            <p className={cn(
              "text-muted-foreground mt-1",
              compact ? "text-sm" : "text-sm"
            )}>
              {description}
            </p>
          )}
        </div>

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
// Section Header
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
        <h2 className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">
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
// Page Container
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
        "px-4 py-6",
        "sm:px-6 lg:px-8 lg:py-8",
        maxWidths[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// Mobile Page Title
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
        "border-b border-border bg-card",
        "sticky top-0 z-20",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Link>
        )}
        <h1 className="text-lg font-semibold text-foreground truncate">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
