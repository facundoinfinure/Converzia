import { cn } from "@/lib/utils";

// ============================================
// Spinner Component
// ============================================

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: "primary" | "white" | "slate";
  className?: string;
}

export function Spinner({ size = "md", color = "primary", className }: SpinnerProps) {
  const sizes = {
    xs: "h-3 w-3 border-[1.5px]",
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]",
    xl: "h-12 w-12 border-4",
  };

  const colors = {
    primary: "border-primary-500 border-t-transparent",
    white: "border-white border-t-transparent",
    slate: "border-slate-500 border-t-transparent",
  };

  return (
    <div
      className={cn(
        "rounded-full animate-spin",
        sizes[size],
        colors[color],
        className
      )}
      role="status"
      aria-label="Cargando"
    >
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

// ============================================
// Loading Overlay
// ============================================

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  className?: string;
}

export function LoadingOverlay({ isLoading, text, className }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex flex-col items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <Spinner size="lg" />
      {text && <p className="mt-4 text-sm text-slate-400">{text}</p>}
    </div>
  );
}

// ============================================
// Full Page Loading
// ============================================

interface FullPageLoadingProps {
  text?: string;
}

export function FullPageLoading({ text = "Cargando..." }: FullPageLoadingProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <Spinner size="xl" />
      <p className="mt-6 text-slate-400">{text}</p>
    </div>
  );
}

// ============================================
// Button Loading State
// ============================================

interface ButtonLoadingProps {
  size?: SpinnerProps["size"];
}

export function ButtonLoading({ size = "sm" }: ButtonLoadingProps) {
  return <Spinner size={size} color="white" />;
}

// ============================================
// Inline Loading
// ============================================

interface InlineLoadingProps {
  text?: string;
  className?: string;
}

export function InlineLoading({ text = "Cargando...", className }: InlineLoadingProps) {
  return (
    <div className={cn("flex items-center gap-2 text-slate-400", className)}>
      <Spinner size="sm" color="slate" />
      <span className="text-sm">{text}</span>
    </div>
  );
}








