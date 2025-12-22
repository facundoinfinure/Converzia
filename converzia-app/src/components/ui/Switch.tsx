import { forwardRef, InputHTMLAttributes, ChangeEvent } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Switch Component
// ============================================

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "onChange"> {
  label?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  labelPosition?: "left" | "right";
  /** Callback when checked state changes - provides boolean directly */
  onCheckedChange?: (checked: boolean) => void;
  /** Native onChange handler */
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      className,
      label,
      description,
      size = "md",
      labelPosition = "right",
      id,
      checked,
      onCheckedChange,
      onChange,
      ...props
    },
    ref
  ) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    const sizes = {
      sm: {
        track: "h-5 w-9",
        thumb: "h-3.5 w-3.5",
        translate: "translate-x-4",
        label: "text-sm",
      },
      md: {
        track: "h-6 w-11",
        thumb: "h-4 w-4",
        translate: "translate-x-5",
        label: "text-sm",
      },
      lg: {
        track: "h-7 w-14",
        thumb: "h-5 w-5",
        translate: "translate-x-7",
        label: "text-base",
      },
    };

    const labelContent = (label || description) && (
      <div className="flex-1">
        {label && (
          <label
            htmlFor={switchId}
            className={cn(
              "font-medium text-[var(--text-secondary)] cursor-pointer",
              props.disabled && "cursor-not-allowed opacity-50",
              sizes[size].label
            )}
          >
            {label}
          </label>
        )}
        {description && (
          <p className="text-[var(--text-tertiary)] text-sm mt-0.5">{description}</p>
        )}
      </div>
    );

    return (
      <div
        className={cn(
          "flex items-center gap-3",
          labelPosition === "left" && "flex-row-reverse justify-end",
          className
        )}
      >
        <div className="relative cursor-pointer" onClick={() => !props.disabled && onCheckedChange?.(!checked)}>
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            checked={checked}
            onChange={handleChange}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              "rounded-full transition-all duration-200",
              "peer-focus:ring-2 peer-focus:ring-primary-500 peer-focus:ring-offset-2 peer-focus:ring-offset-background",
              "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
              sizes[size].track,
              checked
                ? "bg-primary-500"
                : "bg-[var(--border-primary)] peer-hover:bg-[var(--border-secondary)]"
            )}
          />
          <div
            className={cn(
              "absolute top-1 left-1 rounded-full bg-white shadow-sm transition-transform duration-200",
              sizes[size].thumb,
              checked && sizes[size].translate
            )}
          />
        </div>

        {labelContent}
      </div>
    );
  }
);

Switch.displayName = "Switch";









