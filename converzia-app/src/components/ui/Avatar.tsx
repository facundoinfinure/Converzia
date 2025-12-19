import { cn } from "@/lib/utils";

// ============================================
// Avatar Component
// ============================================

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  status?: "online" | "offline" | "away" | "busy";
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  className,
  status,
}: AvatarProps) {
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

  // Get initials from name
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
        <img
          src={src}
          alt={alt || name || "Avatar"}
          className={cn(
            "rounded-full object-cover",
            sizes[size]
          )}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-medium",
            "bg-gradient-to-br from-primary-500 to-primary-600 text-white",
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
  size?: AvatarProps["size"];
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
          <Avatar
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
            "bg-card-border text-slate-300 font-medium",
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
  status?: AvatarProps["status"];
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
      <Avatar src={src} name={name} size={avatarSizes[size]} status={status} />
      <div className="min-w-0">
        <p className={cn("font-medium text-white truncate", textSizes[size].name)}>
          {name}
        </p>
        {(email || role) && (
          <p className={cn("text-slate-500 truncate", textSizes[size].detail)}>
            {email || role}
          </p>
        )}
      </div>
    </div>
  );
}



