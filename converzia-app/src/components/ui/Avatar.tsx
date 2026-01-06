import { ReactNode, forwardRef, HTMLAttributes, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Avatar Components - Radix/shadcn compatible
// ============================================

// Root Avatar container
interface AvatarRootProps extends HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  src?: string | null;
  name?: string;
  alt?: string;
}

const AvatarRoot = forwardRef<HTMLDivElement, AvatarRootProps>(
  ({ className, size = "md", src, name, alt, children, ...props }, ref) => {
    const sizes = {
      xs: "h-6 w-6",
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
      xl: "h-16 w-16",
    };

    const getInitials = (n: string) => {
      return n
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    };

    // If src or name provided, render a complete avatar
    if (src || name) {
      return (
        <div
          ref={ref}
          className={cn(
            "relative flex shrink-0 overflow-hidden rounded-full",
            sizes[size],
            className
          )}
          {...props}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || name || "Avatar"}
              className="aspect-square h-full w-full object-cover"
            />
          ) : name ? (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-medium">
              {getInitials(name)}
            </div>
          ) : null}
        </div>
      );
    }

    // Otherwise render as compound component container
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full",
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AvatarRoot.displayName = "Avatar";

// Avatar Image
interface AvatarImageProps extends ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt = "", ...props }, ref) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      alt={alt}
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  )
);
AvatarImage.displayName = "AvatarImage";

// Avatar Fallback
interface AvatarFallbackProps extends HTMLAttributes<HTMLDivElement> {}

const AvatarFallback = forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-medium",
        className
      )}
      {...props}
    />
  )
);
AvatarFallback.displayName = "AvatarFallback";

// Export as compound component and individually
export { AvatarRoot as Avatar, AvatarImage, AvatarFallback };

// ============================================
// Full Avatar Component (legacy/convenience)
// ============================================

export interface FullAvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  status?: "online" | "offline" | "away" | "busy";
}

export function FullAvatar({
  src,
  alt,
  name,
  size = "md",
  className,
  status,
}: FullAvatarProps) {
  const sizes = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };

  const statusSizes = {
    xs: "h-1.5 w-1.5",
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
    xl: "h-4 w-4",
  };

  const statusColors = {
    online: "bg-emerald-400",
    offline: "bg-slate-500",
    away: "bg-amber-400",
    busy: "bg-red-400",
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = name ? getInitials(name) : "?";

  return (
    <div className={cn("relative inline-flex flex-shrink-0", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || name || "Avatar"}
          className={cn("rounded-full object-cover", sizes[size])}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-medium",
            "bg-gradient-to-br from-primary to-emerald-600 text-white",
            sizes[size]
          )}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-background",
            statusSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}

// ============================================
// Avatar Group
// ============================================

interface AvatarGroupProps {
  avatars: Array<{
    src?: string | null;
    name?: string;
    alt?: string;
  }>;
  max?: number;
  size?: FullAvatarProps["size"];
  className?: string;
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = "md",
  className,
}: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  const overlapSizes = {
    xs: "-ml-1.5",
    sm: "-ml-2",
    md: "-ml-2.5",
    lg: "-ml-3",
    xl: "-ml-4",
  };

  const countSizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-base",
  };

  return (
    <div className={cn("flex items-center", className)}>
      {visibleAvatars.map((avatar, index) => (
        <div
          key={index}
          className={cn(
            "relative ring-2 ring-background rounded-full",
            index > 0 && overlapSizes[size]
          )}
          style={{ zIndex: visibleAvatars.length - index }}
        >
          <FullAvatar
            src={avatar.src}
            name={avatar.name}
            alt={avatar.alt}
            size={size}
          />
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={cn(
            "relative ring-2 ring-background rounded-full flex items-center justify-center",
            "bg-muted text-muted-foreground font-medium",
            overlapSizes[size],
            countSizes[size]
          )}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

// ============================================
// User Avatar (with name and details)
// ============================================

interface UserAvatarProps {
  src?: string | null;
  name: string;
  email?: string;
  role?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  status?: FullAvatarProps["status"];
}

export function UserAvatar({
  src,
  name,
  email,
  role,
  size = "md",
  className,
  status,
}: UserAvatarProps) {
  const avatarSizes = {
    sm: "sm" as const,
    md: "md" as const,
    lg: "lg" as const,
  };

  const textSizes = {
    sm: { name: "text-sm", detail: "text-xs" },
    md: { name: "text-sm", detail: "text-xs" },
    lg: { name: "text-base", detail: "text-sm" },
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <FullAvatar src={src} name={name} size={avatarSizes[size]} status={status} />
      <div className="min-w-0">
        <p className={cn("font-medium text-foreground truncate", textSizes[size].name)}>
          {name}
        </p>
        {(email || role) && (
          <p className={cn("text-muted-foreground truncate", textSizes[size].detail)}>
            {email || role}
          </p>
        )}
      </div>
    </div>
  );
}
