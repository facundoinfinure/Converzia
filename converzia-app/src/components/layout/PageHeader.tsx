import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ============================================
// Page Header Component - Clean, Modern Design
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
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm mb-4">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-[var(--text-primary)] font-medium">
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {title}
          </h1>
          {description && (
            <p className="text-[var(--text-secondary)] mt-1">{description}</p>
          )}
        </div>

        {actions && <div className="flex items-center gap-3">{actions}</div>}
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
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4",
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
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
    <div className={cn("p-6", maxWidths[maxWidth], className)}>{children}</div>
  );
}

