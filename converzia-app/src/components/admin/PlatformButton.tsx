"use client";

import { cn } from "@/lib/utils";

// Platform logos as SVG components
const MetaLogo = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
    <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
  </svg>
);

const TikTokLogo = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1Z" />
  </svg>
);

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
    />
  </svg>
);

const LinkedInLogo = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
    <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2ZM8 19H5v-9h3ZM6.5 8.25A1.75 1.75 0 1 1 8.3 6.5a1.78 1.78 0 0 1-1.8 1.75ZM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19a.66.66 0 0 0 0 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66Z" />
  </svg>
);

export type PlatformType = "META" | "TIKTOK" | "GOOGLE" | "LINKEDIN";

interface PlatformConfig {
  name: string;
  logo: React.FC;
  color: string;
  bgColor: string;
  available: boolean;
}

const platforms: Record<PlatformType, PlatformConfig> = {
  META: {
    name: "Meta",
    logo: MetaLogo,
    color: "text-[#1877F2]",
    bgColor: "bg-[#1877F2]/10 hover:bg-[#1877F2]/20",
    available: true,
  },
  TIKTOK: {
    name: "TikTok",
    logo: TikTokLogo,
    color: "text-[#000000] dark:text-white",
    bgColor: "bg-black/5 dark:bg-white/10",
    available: false,
  },
  GOOGLE: {
    name: "Google",
    logo: GoogleLogo,
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    available: false,
  },
  LINKEDIN: {
    name: "LinkedIn",
    logo: LinkedInLogo,
    color: "text-[#0A66C2]",
    bgColor: "bg-[#0A66C2]/10",
    available: false,
  },
};

interface PlatformButtonProps {
  platform: PlatformType;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PlatformButton({
  platform,
  onClick,
  selected = false,
  disabled = false,
  size = "md",
}: PlatformButtonProps) {
  const config = platforms[platform];
  const isAvailable = config.available && !disabled;

  const sizeClasses = {
    sm: "h-16 w-20",
    md: "h-20 w-24",
    lg: "h-24 w-28",
  };

  return (
    <button
      type="button"
      onClick={isAvailable ? onClick : undefined}
      disabled={!isAvailable}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 transition-all duration-200",
        sizeClasses[size],
        isAvailable
          ? cn(
              config.bgColor,
              "border-transparent cursor-pointer",
              selected && "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20"
            )
          : "bg-[var(--bg-tertiary)] border-[var(--border-primary)] cursor-not-allowed opacity-60"
      )}
    >
      <div className={cn(isAvailable ? config.color : "text-[var(--text-tertiary)]")}>
        <config.logo />
      </div>
      <span
        className={cn(
          "text-xs font-medium",
          isAvailable ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
        )}
      >
        {config.name}
      </span>
      
      {/* Coming Soon badge */}
      {!config.available && (
        <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--bg-secondary)] text-[var(--text-tertiary)] rounded border border-[var(--border-primary)]">
          Próximamente
        </span>
      )}
    </button>
  );
}

interface PlatformSelectorProps {
  selectedPlatform?: PlatformType;
  onSelect: (platform: PlatformType) => void;
  size?: "sm" | "md" | "lg";
}

export function PlatformSelector({
  selectedPlatform,
  onSelect,
  size = "md",
}: PlatformSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {(Object.keys(platforms) as PlatformType[]).map((platform) => (
        <PlatformButton
          key={platform}
          platform={platform}
          selected={selectedPlatform === platform}
          onClick={() => onSelect(platform)}
          size={size}
        />
      ))}
    </div>
  );
}

// Export platform configs for external use
export { platforms };

