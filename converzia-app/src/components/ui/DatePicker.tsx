"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
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
// Date Range Picker
// ============================================

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  value = { from: null, to: null },
  onChange,
  label,
  placeholder = "Seleccionar rango",
  error,
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
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

  const formatDateRange = (): string => {
    if (!value.from && !value.to) return placeholder;
    const formatDate = (d: Date) =>
      d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
    if (value.from && value.to) {
      return `${formatDate(value.from)} - ${formatDate(value.to)}`;
    }
    if (value.from) return `Desde ${formatDate(value.from)}`;
    return placeholder;
  };

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}

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
        <span className={value.from || value.to ? "text-white" : "text-slate-500"}>
          {formatDateRange()}
        </span>
        <Calendar className="h-4 w-4 text-slate-500" />
      </button>

      {/* Simplified dropdown - in production, use a proper calendar library */}
      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-card border border-card-border rounded-lg shadow-xl">
          <p className="text-sm text-slate-400 mb-4">
            {selectingEnd ? "Seleccioná la fecha final" : "Seleccioná la fecha inicial"}
          </p>

          {/* Quick presets */}
          <div className="space-y-1">
            {[
              { label: "Hoy", from: new Date(), to: new Date() },
              {
                label: "Últimos 7 días",
                from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                to: new Date(),
              },
              {
                label: "Últimos 30 días",
                from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                to: new Date(),
              },
              {
                label: "Este mes",
                from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                to: new Date(),
              },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onChange?.(preset);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-card-border hover:text-white rounded transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-card-border flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange?.({ from: null, to: null });
                setIsOpen(false);
              }}
            >
              Limpiar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-1.5">{error}</p>}
    </div>
  );
}










