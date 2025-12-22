import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================
// TextArea Component
// ============================================

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  showCount?: boolean;
  resize?: "none" | "vertical" | "horizontal" | "both";
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      label,
      error,
      hint,
      showCount = false,
      maxLength,
      resize = "vertical",
      id,
      value,
      ...props
    },
    ref
  ) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const currentLength = typeof value === "string" ? value.length : 0;

    const resizeClasses = {
      none: "resize-none",
      vertical: "resize-y",
      horizontal: "resize-x",
      both: "resize",
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          maxLength={maxLength}
          className={cn(
            "w-full rounded-lg border bg-card text-white placeholder-slate-500 px-4 py-3",
            "transition-all duration-200 min-h-[100px]",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-card-border",
            resizeClasses[resize],
            error
              ? "border-red-500 focus:ring-red-500 focus:border-red-500"
              : "border-card-border",
            className
          )}
          {...props}
        />

        <div className="flex items-center justify-between mt-1.5">
          {(error || hint) && (
            <p
              className={cn(
                "text-sm",
                error ? "text-red-400" : "text-slate-500"
              )}
            >
              {error || hint}
            </p>
          )}

          {showCount && maxLength && (
            <p
              className={cn(
                "text-sm ml-auto",
                currentLength >= maxLength ? "text-red-400" : "text-slate-500"
              )}
            >
              {currentLength}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

TextArea.displayName = "TextArea";








