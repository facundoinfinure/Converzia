import { cn } from "@/lib/utils";

// ============================================
// Skeleton Component
// ============================================

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  className,
  variant = "text",
  animation = "pulse",
}: SkeletonProps) {
  const variants = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const animations = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  return (
    <div
      className={cn(
        "bg-card-border",
        variants[variant],
        animations[animation],
        className
      )}
    />
  );
}

// ============================================
// Text Skeleton
// ============================================

interface TextSkeletonProps {
  lines?: number;
  className?: string;
}

export function TextSkeleton({ lines = 3, className }: TextSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

// ============================================
// Card Skeleton
// ============================================

interface CardSkeletonProps {
  hasImage?: boolean;
  hasActions?: boolean;
  className?: string;
}

export function CardSkeleton({
  hasImage = false,
  hasActions = true,
  className,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-card-border bg-card overflow-hidden",
        className
      )}
    >
      {hasImage && <Skeleton className="h-48 w-full rounded-none" variant="rectangular" />}

      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <TextSkeleton lines={2} />

        {hasActions && (
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-24" variant="rectangular" />
            <Skeleton className="h-9 w-24" variant="rectangular" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Table Row Skeleton
// ============================================

interface TableRowSkeletonProps {
  columns?: number;
  rows?: number;
  hasCheckbox?: boolean;
  className?: string;
}

export function TableRowSkeleton({
  columns = 5,
  rows = 5,
  hasCheckbox = false,
  className,
}: TableRowSkeletonProps) {
  return (
    <div className={cn("divide-y divide-card-border", className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-6 py-4">
          {hasCheckbox && <Skeleton className="h-5 w-5" variant="rectangular" />}
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn(
                "h-5 flex-1",
                colIndex === 0 ? "max-w-[200px]" : "max-w-[150px]"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Avatar Skeleton
// ============================================

interface AvatarSkeletonProps {
  size?: "sm" | "md" | "lg";
  withText?: boolean;
  className?: string;
}

export function AvatarSkeleton({
  size = "md",
  withText = false,
  className,
}: AvatarSkeletonProps) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Skeleton className={sizes[size]} variant="circular" />
      {withText && (
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      )}
    </div>
  );
}

// ============================================
// Stat Card Skeleton
// ============================================

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-card-border bg-card p-6",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-12 w-12" variant="rectangular" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

// ============================================
// Form Skeleton
// ============================================

interface FormSkeletonProps {
  fields?: number;
  hasSubmit?: boolean;
  className?: string;
}

export function FormSkeleton({
  fields = 4,
  hasSubmit = true,
  className,
}: FormSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" variant="rectangular" />
        </div>
      ))}

      {hasSubmit && (
        <div className="flex justify-end gap-3 pt-4">
          <Skeleton className="h-10 w-24" variant="rectangular" />
          <Skeleton className="h-10 w-32" variant="rectangular" />
        </div>
      )}
    </div>
  );
}

// ============================================
// List Skeleton
// ============================================

interface ListSkeletonProps {
  items?: number;
  hasAvatar?: boolean;
  hasAction?: boolean;
  className?: string;
}

export function ListSkeleton({
  items = 5,
  hasAvatar = true,
  hasAction = true,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn("divide-y divide-card-border", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          {hasAvatar && <Skeleton className="h-10 w-10" variant="circular" />}
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          {hasAction && <Skeleton className="h-8 w-20" variant="rectangular" />}
        </div>
      ))}
    </div>
  );
}











