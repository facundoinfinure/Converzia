"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Bottom Navigation - Mobile Pattern
// ============================================

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
  activeIcon?: ReactNode;
  badge?: number;
}

interface BottomNavigationProps {
  items: NavItem[];
  className?: string;
}

export function BottomNavigation({ items, className }: BottomNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[250] lg:hidden",
        "bg-[var(--bg-primary)] border-t border-[var(--border-primary)]",
        "pb-[env(safe-area-inset-bottom,0px)]",
        "animate-slideInUp",
        className
      )}
    >
      <div className="flex items-center justify-around h-[72px] px-2">
        {items.map((item) => {
          const isActive = item.href === pathname.split("/").slice(0, 3).join("/")
            ? pathname === item.href || pathname.startsWith(item.href + "/")
            : pathname.startsWith(item.href);
            
          // For root paths like /admin or /portal, exact match
          const isExactActive = item.href.split("/").length <= 2 
            ? pathname === item.href 
            : isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 relative",
                "min-w-[64px] min-h-[52px] rounded-xl",
                "transition-all duration-200 ease-out",
                "active:scale-95",
                isExactActive
                  ? "text-[var(--accent-primary)]"
                  : "text-[var(--text-tertiary)] active:text-[var(--text-secondary)]"
              )}
            >
              {/* Active indicator dot */}
              {isExactActive && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-primary)] animate-scaleIn" />
              )}
              
              {/* Icon container with active background */}
              <span
                className={cn(
                  "flex items-center justify-center w-12 h-8 rounded-xl transition-all duration-200",
                  isExactActive && "bg-[var(--accent-primary-light)]"
                )}
              >
                <span className={cn("transition-transform duration-200", isExactActive && "scale-110")}>
                  {isExactActive && item.activeIcon ? item.activeIcon : item.icon}
                </span>
                
                {/* Badge */}
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--error)] text-white text-[10px] font-bold px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              
              {/* Label */}
              <span
                className={cn(
                  "text-[11px] font-medium transition-all duration-200",
                  isExactActive && "font-semibold"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================
// Floating Action Button (FAB) - Mobile
// ============================================

interface FABProps {
  icon: ReactNode;
  onClick: () => void;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}

export function FloatingActionButton({
  icon,
  onClick,
  label,
  variant = "primary",
  className,
}: FABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed right-4 z-[240] lg:hidden",
        "flex items-center justify-center gap-2",
        "rounded-full shadow-lg",
        "transition-all duration-200 ease-out",
        "active:scale-95",
        // Position above bottom nav
        "bottom-[calc(72px+env(safe-area-inset-bottom,0px)+16px)]",
        variant === "primary" && [
          "bg-[var(--accent-primary)] text-white",
          "hover:shadow-[var(--shadow-glow)]",
        ],
        variant === "secondary" && [
          "bg-[var(--bg-primary)] text-[var(--text-primary)]",
          "border border-[var(--border-primary)]",
        ],
        label ? "px-5 h-14" : "w-14 h-14",
        className
      )}
      aria-label={label}
    >
      <span className="w-6 h-6">{icon}</span>
      {label && <span className="font-semibold text-sm">{label}</span>}
    </button>
  );
}

