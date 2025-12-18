"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

/**
 * SimpleChart - Gráfico de línea simple
 * Minimalista, con colores sutiles
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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        {showAxis && <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />}
        {showAxis && <YAxis stroke="#9ca3af" fontSize={12} />}
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
          labelStyle={{ color: "#1a1a1a", fontWeight: 500, fontSize: "12px" }}
          itemStyle={{ color: "#6b7280", fontSize: "12px" }}
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
