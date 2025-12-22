"use client";

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useTheme } from "@/lib/hooks/use-theme";

interface AnalyticsChartsProps {
  leadsByDay: Array<{ date: string; value: number }>;
  conversionByDay: Array<{ date: string; value: number }>;
  leadsByStatus: Array<{ status: string; count: number }>;
  leadsByTenant: Array<{ tenant: string; count: number }>;
}

export function AnalyticsCharts({
  leadsByDay,
  conversionByDay,
  leadsByStatus,
  leadsByTenant,
}: AnalyticsChartsProps) {
  const { isDark } = useTheme();

  // Theme-aware colors using CSS variable values
  const gridColor = isDark ? "#27272A" : "#E5E7EB";
  const axisColor = isDark ? "#71717A" : "#6B7280";
  const tooltipBg = isDark ? "#18181B" : "#FFFFFF";
  const tooltipBorder = isDark ? "#27272A" : "#E5E7EB";
  const tooltipText = isDark ? "#FAFAFA" : "#111827";

  const chartColors = {
    primary: isDark ? "#818CF8" : "#6366F1",
    success: isDark ? "#34D399" : "#10B981",
    info: isDark ? "#60A5FA" : "#3B82F6",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Leads by Day */}
      <Card>
        <CardHeader>
          <CardTitle>Leads por Día</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={leadsByDay} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: "8px",
                  color: tooltipText,
                }}
                labelStyle={{ color: tooltipText, fontWeight: 500 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColors.primary}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: chartColors.primary }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Tasa de Conversión</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={conversionByDay} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: "8px",
                  color: tooltipText,
                }}
                labelStyle={{ color: tooltipText, fontWeight: 500 }}
                formatter={(value: any) => `${value}%`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColors.success}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: chartColors.success }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Leads by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Leads por Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadsByStatus} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="status" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: "8px",
                  color: tooltipText,
                }}
                labelStyle={{ color: tooltipText, fontWeight: 500 }}
              />
              <Bar dataKey="count" fill={chartColors.primary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Leads by Tenant */}
      <Card>
        <CardHeader>
          <CardTitle>Top Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadsByTenant} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="tenant" stroke={axisColor} fontSize={12} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke={axisColor} fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: "8px",
                  color: tooltipText,
                }}
                labelStyle={{ color: tooltipText, fontWeight: 500 }}
              />
              <Bar dataKey="count" fill={chartColors.info} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
