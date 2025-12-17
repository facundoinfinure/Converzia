"use client";

import { useState, ReactNode } from "react";
import { Filter, X, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { MercuryButton } from "./MercuryButton";
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
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onReset?: () => void;
  savedFilters?: Array<{ name: string; values: Record<string, any> }>;
  onSaveFilter?: (name: string, values: Record<string, any>) => void;
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

  const handleFilterChange = (key: string, value: any) => {
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
      <MercuryButton
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        leftIcon={<Filter className="h-4 w-4" />}
      >
        Filtros
        {activeFiltersCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-600 text-white">
            {activeFiltersCount}
          </span>
        )}
      </MercuryButton>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Filtros Avanzados</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filters.map((filter) => (
                <div key={filter.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {filter.label}
                  </label>
                  {filter.type === "text" && (
                    <Input
                      value={values[filter.key] || ""}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      placeholder={filter.placeholder}
                    />
                  )}
                  {filter.type === "date" && (
                    <DatePicker
                      value={values[filter.key]}
                      onChange={(date) => handleFilterChange(filter.key, date?.toISOString())}
                    />
                  )}
                  {filter.type === "dateRange" && (
                    <div className="flex items-center gap-2">
                      <DatePicker
                        value={values[`${filter.key}_start`]}
                        onChange={(date) => handleFilterChange(`${filter.key}_start`, date?.toISOString())}
                        placeholder="Desde"
                      />
                      <span className="text-gray-400">-</span>
                      <DatePicker
                        value={values[`${filter.key}_end`]}
                        onChange={(date) => handleFilterChange(`${filter.key}_end`, date?.toISOString())}
                        placeholder="Hasta"
                      />
                    </div>
                  )}
                  {filter.type === "number" && (
                    <Input
                      type="number"
                      value={values[filter.key] || ""}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value ? Number(e.target.value) : null)}
                      placeholder={filter.placeholder}
                    />
                  )}
                  {filter.type === "numberRange" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={values[`${filter.key}_min`] || ""}
                        onChange={(e) => handleFilterChange(`${filter.key}_min`, e.target.value ? Number(e.target.value) : null)}
                        placeholder="Mín"
                      />
                      <span className="text-gray-400">-</span>
                      <Input
                        type="number"
                        value={values[`${filter.key}_max`] || ""}
                        onChange={(e) => handleFilterChange(`${filter.key}_max`, e.target.value ? Number(e.target.value) : null)}
                        placeholder="Máx"
                      />
                    </div>
                  )}
                  {filter.type === "select" && (
                    <select
                      value={values[filter.key] || ""}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Filtros Guardados</p>
                <div className="space-y-1">
                  {savedFilters.map((saved, idx) => (
                    <button
                      key={idx}
                      onClick={() => onChange(saved.values)}
                      className="w-full text-left px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded"
                    >
                      {saved.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-200">
              <MercuryButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange({});
                  onReset?.();
                }}
              >
                Limpiar
              </MercuryButton>
              {onSaveFilter && (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={saveFilterName}
                    onChange={(e) => setSaveFilterName(e.target.value)}
                    placeholder="Nombre del filtro"
                    className="flex-1"
                  />
                  <MercuryButton
                    size="sm"
                    variant="primary"
                    onClick={handleSaveFilter}
                    disabled={!saveFilterName}
                  >
                    Guardar
                  </MercuryButton>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
