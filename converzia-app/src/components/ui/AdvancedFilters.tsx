"use client";

import { useState, ReactNode } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { DatePicker } from "./DatePicker";
import { cn } from "@/lib/utils";

export interface FilterConfig {
  key: string;
  label: string;
  type: "text" | "date" | "dateRange" | "number" | "numberRange" | "select";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

interface AdvancedFiltersProps {
  filters: FilterConfig[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onReset?: () => void;
  savedFilters?: Array<{ name: string; values: Record<string, unknown> }>;
  onSaveFilter?: (name: string, values: Record<string, unknown>) => void;
  className?: string;
}

export function AdvancedFilters({
  filters,
  values,
  onChange,
  onReset,
  savedFilters = [],
  onSaveFilter,
  className,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");

  const asInputValue = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return "";
  };

  const asDateValue = (v: unknown): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const handleFilterChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  const handleSaveFilter = () => {
    if (saveFilterName && onSaveFilter) {
      onSaveFilter(saveFilterName, values);
      setSaveFilterName("");
    }
  };

  const activeFiltersCount = Object.values(values).filter((v) => v !== "" && v !== null && v !== undefined).length;

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        leftIcon={<Filter className="h-4 w-4" />}
      >
        Filtros
        {activeFiltersCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[var(--accent-primary)] text-white">
            {activeFiltersCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-96 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-lg z-50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text-primary)]">Filtros Avanzados</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filters.map((filter) => (
                <div key={filter.key}>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    {filter.label}
                  </label>
                  {filter.type === "text" && (
                    <Input
                      value={asInputValue(values[filter.key])}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      placeholder={filter.placeholder}
                    />
                  )}
                  {filter.type === "date" && (
                    <DatePicker
                      value={asDateValue(values[filter.key])}
                      onChange={(date) => handleFilterChange(filter.key, date?.toISOString())}
                    />
                  )}
                  {filter.type === "dateRange" && (
                    <div className="flex items-center gap-2">
                      <DatePicker
                        value={asDateValue(values[`${filter.key}_start`])}
                        onChange={(date) => handleFilterChange(`${filter.key}_start`, date?.toISOString())}
                        placeholder="Desde"
                      />
                      <span className="text-[var(--text-tertiary)]">-</span>
                      <DatePicker
                        value={asDateValue(values[`${filter.key}_end`])}
                        onChange={(date) => handleFilterChange(`${filter.key}_end`, date?.toISOString())}
                        placeholder="Hasta"
                      />
                    </div>
                  )}
                  {filter.type === "number" && (
                    <Input
                      type="number"
                      value={asInputValue(values[filter.key])}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value ? Number(e.target.value) : null)}
                      placeholder={filter.placeholder}
                    />
                  )}
                  {filter.type === "numberRange" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={asInputValue(values[`${filter.key}_min`])}
                        onChange={(e) => handleFilterChange(`${filter.key}_min`, e.target.value ? Number(e.target.value) : null)}
                        placeholder="Mín"
                      />
                      <span className="text-[var(--text-tertiary)]">-</span>
                      <Input
                        type="number"
                        value={asInputValue(values[`${filter.key}_max`])}
                        onChange={(e) => handleFilterChange(`${filter.key}_max`, e.target.value ? Number(e.target.value) : null)}
                        placeholder="Máx"
                      />
                    </div>
                  )}
                  {filter.type === "select" && (
                    <select
                      value={asInputValue(values[filter.key])}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    >
                      <option value="">Todos</option>
                      {filter.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Filtros Guardados</p>
                <div className="space-y-1">
                  {savedFilters.map((saved, idx) => (
                    <button
                      key={idx}
                      onClick={() => onChange(saved.values)}
                      className="w-full text-left px-2 py-1 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded"
                    >
                      {saved.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-[var(--border-primary)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange({});
                  onReset?.();
                }}
              >
                Limpiar
              </Button>
              {onSaveFilter && (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={saveFilterName}
                    onChange={(e) => setSaveFilterName(e.target.value)}
                    placeholder="Nombre del filtro"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveFilter}
                    disabled={!saveFilterName}
                  >
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
