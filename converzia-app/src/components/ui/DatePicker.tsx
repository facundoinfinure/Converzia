"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

// ============================================
// Date Picker Component
// ============================================

interface DatePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Seleccionar fecha",
  error,
  disabled = false,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add days from previous month to fill the first week
    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Add days from next month to fill the last week
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === viewDate.getMonth();
  };

  const handleDateSelect = (date: Date) => {
    if (isDateDisabled(date)) return;
    onChange?.(date);
    setIsOpen(false);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setViewDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const days = getDaysInMonth(viewDate);
  const monthName = viewDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Input */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border bg-card text-left",
            "transition-all duration-200",
            disabled && "opacity-50 cursor-not-allowed",
            error
              ? "border-red-500"
              : isOpen
              ? "border-primary-500 ring-2 ring-primary-500"
              : "border-card-border hover:border-slate-600"
          )}
        >
          <span className={value ? "text-white" : "text-slate-500"}>
            {value ? formatDate(value) : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(null);
                }}
                className="p-0.5 rounded hover:bg-card-border text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <Calendar className="h-4 w-4 text-slate-500" />
          </div>
        </button>

        {/* Calendar dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-2 p-4 bg-card border border-card-border rounded-lg shadow-xl w-[300px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => navigateMonth("prev")}
                className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium text-white capitalize">
                {monthName}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth("next")}
                className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((day) => (
                <div
                  key={day}
                  className="h-8 flex items-center justify-center text-xs font-medium text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                const isSelected = value && isSameDay(date, value);
                const isToday = isSameDay(date, new Date());
                const isDisabled = isDateDisabled(date);
                const isOtherMonth = !isCurrentMonth(date);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDateSelect(date)}
                    disabled={isDisabled}
                    className={cn(
                      "h-8 w-8 flex items-center justify-center rounded text-sm transition-colors",
                      isSelected
                        ? "bg-primary-500 text-white"
                        : isToday
                        ? "bg-primary-500/20 text-primary-400"
                        : isDisabled
                        ? "text-slate-700 cursor-not-allowed"
                        : isOtherMonth
                        ? "text-slate-600 hover:bg-card-border"
                        : "text-slate-300 hover:bg-card-border hover:text-white"
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-card-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange?.(new Date());
                  setIsOpen(false);
                }}
              >
                Hoy
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-1.5">{error}</p>}
    </div>
  );
}

// ============================================
// Date Range Picker with Presets
// ============================================

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export type DatePresetId = 
  | "all_time" 
  | "this_month" 
  | "last_month" 
  | "last_30_days" 
  | "last_7_days" 
  | "yesterday" 
  | "today" 
  | "custom";

export interface DatePreset {
  id: DatePresetId;
  label: string;
  getRange: () => DateRange;
}

// Helper to get start of day
const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper to get end of day
const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Default presets
export const DEFAULT_DATE_PRESETS: DatePreset[] = [
  {
    id: "all_time",
    label: "Desde el comienzo",
    getRange: () => ({ from: null, to: null }),
  },
  {
    id: "this_month",
    label: "Mes actual",
    getRange: () => ({
      from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      to: endOfDay(new Date()),
    }),
  },
  {
    id: "last_month",
    label: "Último mes",
    getRange: () => {
      const now = new Date();
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: startOfDay(firstDayLastMonth),
        to: endOfDay(lastDayLastMonth),
      };
    },
  },
  {
    id: "last_30_days",
    label: "Últimos 30 días",
    getRange: () => ({
      from: startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      to: endOfDay(new Date()),
    }),
  },
  {
    id: "last_7_days",
    label: "Últimos 7 días",
    getRange: () => ({
      from: startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      to: endOfDay(new Date()),
    }),
  },
  {
    id: "yesterday",
    label: "Ayer",
    getRange: () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    },
  },
  {
    id: "today",
    label: "Hoy",
    getRange: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
];

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange, presetId?: DatePresetId) => void;
  selectedPreset?: DatePresetId;
  onPresetChange?: (presetId: DatePresetId) => void;
  presets?: DatePreset[];
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  showCustomCalendar?: boolean;
  compact?: boolean;
}

export function DateRangePicker({
  value = { from: null, to: null },
  onChange,
  selectedPreset,
  onPresetChange,
  presets = DEFAULT_DATE_PRESETS,
  label,
  placeholder = "Seleccionar período",
  error,
  disabled = false,
  className,
  showCustomCalendar = true,
  compact = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [customFrom, setCustomFrom] = useState<Date | null>(value.from);
  const [customTo, setCustomTo] = useState<Date | null>(value.to);
  const [viewDate, setViewDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setMode("presets");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDateRange = (): string => {
    // If we have a selected preset, show its label
    if (selectedPreset && selectedPreset !== "custom") {
      const preset = presets.find(p => p.id === selectedPreset);
      if (preset) return preset.label;
    }
    
    if (!value.from && !value.to) return placeholder;
    
    const formatDate = (d: Date) =>
      d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
    
    if (value.from && value.to) {
      // Check if same day
      if (value.from.toDateString() === value.to.toDateString()) {
        return formatDate(value.from);
      }
      return `${formatDate(value.from)} - ${formatDate(value.to)}`;
    }
    if (value.from) return `Desde ${formatDate(value.from)}`;
    return placeholder;
  };

  const handlePresetSelect = (preset: DatePreset) => {
    const range = preset.getRange();
    onChange?.(range, preset.id);
    onPresetChange?.(preset.id);
    setIsOpen(false);
    setMode("presets");
  };

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const isSameDay = (date1: Date, date2: Date | null): boolean => {
    if (!date2) return false;
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isInRange = (date: Date): boolean => {
    if (!customFrom || !customTo) return false;
    return date >= customFrom && date <= customTo;
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === viewDate.getMonth();
  };

  const handleDateClick = (date: Date) => {
    if (!customFrom || (customFrom && customTo)) {
      // Start new selection
      setCustomFrom(startOfDay(date));
      setCustomTo(null);
    } else {
      // Complete selection
      if (date < customFrom) {
        setCustomTo(endOfDay(customFrom));
        setCustomFrom(startOfDay(date));
      } else {
        setCustomTo(endOfDay(date));
      }
    }
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      onChange?.({ from: customFrom, to: customTo }, "custom");
      onPresetChange?.("custom");
      setIsOpen(false);
      setMode("presets");
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setViewDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const days = getDaysInMonth(viewDate);
  const monthName = viewDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-[var(--bg-primary)] text-left",
          "transition-all duration-200",
          compact ? "px-3 py-2 text-sm" : "px-4 py-2.5",
          disabled && "opacity-50 cursor-not-allowed",
          error
            ? "border-[var(--error)]"
            : isOpen
            ? "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20"
            : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
        )}
      >
        <Calendar className={cn("text-[var(--text-tertiary)]", compact ? "h-4 w-4" : "h-4 w-4")} />
        <span className={value.from || value.to || selectedPreset ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}>
          {formatDateRange()}
        </span>
        <ChevronDown className={cn(
          "ml-auto text-[var(--text-tertiary)] transition-transform",
          compact ? "h-4 w-4" : "h-4 w-4",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-xl overflow-hidden min-w-[280px]">
          {mode === "presets" ? (
            <>
              {/* Presets list */}
              <div className="p-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm rounded-lg transition-colors",
                      selectedPreset === preset.id
                        ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {showCustomCalendar && (
                <div className="border-t border-[var(--border-primary)] p-2">
                  <button
                    type="button"
                    onClick={() => setMode("custom")}
                    className="w-full px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Personalizado...
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Custom calendar */}
              <div className="p-4">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => navigateMonth("prev")}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
                    {monthName}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateMonth("next")}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Day names */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((day) => (
                    <div
                      key={day}
                      className="h-8 flex items-center justify-center text-xs font-medium text-[var(--text-tertiary)]"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((date, index) => {
                    const isStart = isSameDay(date, customFrom);
                    const isEnd = isSameDay(date, customTo);
                    const inRange = isInRange(date);
                    const isToday = isSameDay(date, new Date());
                    const isOtherMonth = !isCurrentMonth(date);

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleDateClick(date)}
                        className={cn(
                          "h-8 w-8 flex items-center justify-center rounded text-sm transition-colors",
                          isStart || isEnd
                            ? "bg-[var(--accent-primary)] text-white"
                            : inRange
                            ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
                            : isToday
                            ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                            : isOtherMonth
                            ? "text-[var(--text-tertiary)]/50 hover:bg-[var(--bg-tertiary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                {/* Selected range display */}
                {(customFrom || customTo) && (
                  <div className="mt-4 p-2 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-secondary)]">
                    {customFrom && customTo ? (
                      <>
                        {customFrom.toLocaleDateString("es-AR")} - {customTo.toLocaleDateString("es-AR")}
                      </>
                    ) : customFrom ? (
                      <>Desde {customFrom.toLocaleDateString("es-AR")} - Seleccioná fin</>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-[var(--border-primary)] p-3 flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMode("presets");
                    setCustomFrom(value.from);
                    setCustomTo(value.to);
                  }}
                >
                  Volver
                </Button>
                <Button
                  size="sm"
                  onClick={applyCustomRange}
                  disabled={!customFrom || !customTo}
                >
                  Aplicar
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-[var(--error)] text-sm mt-1.5">{error}</p>}
    </div>
  );
}











