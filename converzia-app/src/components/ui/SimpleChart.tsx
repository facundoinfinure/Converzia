"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useTheme } from "@/lib/hooks/use-theme";

/**
 * SimpleChart - Gráfico de línea simple
 * Minimalista, con colores sutiles
 * Adaptativo al tema (dark/light mode)
 */
export interface SimpleChartProps {
  data: Array<{ date: string; value: number; label?: string }>;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showAxis?: boolean;
}

export function SimpleChart({
  data,
  color = "#3b82f6", // Blue
  height = 200,
  showGrid = false,
  showAxis = false,
}: SimpleChartProps) {
  const { isDark } = useTheme();

  // Colores adaptativos
  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const axisColor = isDark ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDark ? "#1f2937" : "white";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";
  const tooltipLabelColor = isDark ? "#f9fafb" : "#1a1a1a";
  const tooltipItemColor = isDark ? "#d1d5db" : "#6b7280";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
        {showAxis && <XAxis dataKey="date" stroke={axisColor} fontSize={12} />}
        {showAxis && <YAxis stroke={axisColor} fontSize={12} />}
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
          labelStyle={{ color: tooltipLabelColor, fontWeight: 500, fontSize: "12px" }}
          itemStyle={{ color: tooltipItemColor, fontSize: "12px" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
