import { ReactNode } from "react";
import { FileQuestion, Search, Inbox, Users, Package, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
}: EmptyStateProps) {
  const sizes = {
    sm: {
      icon: "h-8 w-8",
      iconWrapper: "h-14 w-14",
      title: "text-base",
      description: "text-sm",
      padding: "py-8",
    },
    md: {
      icon: "h-10 w-10",
      iconWrapper: "h-20 w-20",
      title: "text-lg",
      description: "text-sm",
      padding: "py-12",
    },
    lg: {
      icon: "h-12 w-12",
      iconWrapper: "h-24 w-24",
      title: "text-xl",
      description: "text-base",
      padding: "py-16",
    },
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes[size].padding,
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "rounded-full bg-card-border flex items-center justify-center mb-4",
            sizes[size].iconWrapper
          )}
        >
          <span className={cn("text-slate-500", sizes[size].icon)}>{icon}</span>
        </div>
      )}

      <h3 className={cn("font-semibold text-white", sizes[size].title)}>
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            "text-slate-400 mt-1 max-w-sm",
            sizes[size].description
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Preset Empty States
// ============================================

interface PresetEmptyStateProps {
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function NoDataEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<Inbox />}
      title="No hay datos"
      description="No hay información disponible para mostrar en este momento."
      action={action}
      className={className}
    />
  );
}

export function NoSearchResultsEmptyState({
  query,
  onClear,
  className,
}: {
  query?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={<Search />}
      title="Sin resultados"
      description={
        query
          ? `No encontramos resultados para "${query}". Intentá con otros términos.`
          : "No encontramos resultados para tu búsqueda."
      }
      action={
        onClear
          ? {
              label: "Limpiar búsqueda",
              onClick: onClear,
            }
          : undefined
      }
      className={className}
    />
  );
}

export function NoLeadsEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<Users />}
      title="No hay leads"
      description="Todavía no hay leads registrados. Cuando lleguen leads de tus campañas, aparecerán aquí."
      action={action}
      className={className}
    />
  );
}

export function NoOffersEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<Package />}
      title="No hay ofertas"
      description="Creá tu primera oferta para empezar a recibir y calificar leads."
      action={action}
      className={className}
    />
  );
}

export function NoTenantsEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<Users />}
      title="No hay tenants"
      description="No hay tenants registrados en la plataforma. Creá el primero para comenzar."
      action={action}
      className={className}
    />
  );
}

export function ErrorEmptyState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={<AlertCircle />}
      title="Algo salió mal"
      description={message || "Ocurrió un error al cargar los datos. Por favor, intentá de nuevo."}
      action={
        onRetry
          ? {
              label: "Reintentar",
              onClick: onRetry,
            }
          : undefined
      }
      className={className}
    />
  );
}

export function NotFoundEmptyState({
  title = "Página no encontrada",
  description = "La página que buscás no existe o fue movida.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: PresetEmptyStateProps["action"];
  className?: string;
}) {
  return (
    <EmptyState
      icon={<FileQuestion />}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

