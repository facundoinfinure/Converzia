"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  priority?: boolean;
}

/**
 * OptimizedImage - Wrapper around Next.js Image with lazy loading
 * Provides better performance and responsive images
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  fill = false,
  priority = false,
}: OptimizedImageProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={cn(
          "bg-gray-200 flex items-center justify-center text-gray-400",
          className
        )}
        style={!fill && width && height ? { width, height } : undefined}
      >
        <span className="text-xs">Sin imagen</span>
      </div>
    );
  }

  try {
    if (fill) {
      return (
        <Image
          src={src}
          alt={alt}
          fill
          className={className}
          loading={priority ? undefined : "lazy"}
          priority={priority}
          onError={() => setError(true)}
        />
      );
    }

    return (
      <Image
        src={src}
        alt={alt}
        width={width || 400}
        height={height || 300}
        className={className}
        loading={priority ? undefined : "lazy"}
        priority={priority}
        onError={() => setError(true)}
      />
    );
  } catch {
    // Fallback to regular img if Next.js Image fails
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? undefined : "lazy"}
        onError={() => setError(true)}
      />
    );
  }
}
