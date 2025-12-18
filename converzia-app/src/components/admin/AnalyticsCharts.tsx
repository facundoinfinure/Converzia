"use client";

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { LightCard, LightCardHeader, LightCardTitle, LightCardContent } from "@/components/ui/LightCard";

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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Leads by Day */}
      <LightCard>
        <LightCardHeader>
          <LightCardTitle>Leads por Día</LightCardTitle>
        </LightCardHeader>
        <LightCardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={leadsByDay} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </LightCardContent>
      </LightCard>

      {/* Conversion Rate */}
      <LightCard>
        <LightCardHeader>
          <LightCardTitle>Tasa de Conversión</LightCardTitle>
        </LightCardHeader>
        <LightCardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={conversionByDay} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
                formatter={(value: any) => `${value}%`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </LightCardContent>
      </LightCard>

      {/* Leads by Status */}
      <LightCard>
        <LightCardHeader>
          <LightCardTitle>Leads por Estado</LightCardTitle>
        </LightCardHeader>
        <LightCardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadsByStatus} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="status" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </LightCardContent>
      </LightCard>

      {/* Leads by Tenant */}
      <LightCard>
        <LightCardHeader>
          <LightCardTitle>Top Tenants</LightCardTitle>
        </LightCardHeader>
        <LightCardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadsByTenant} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="tenant" stroke="#9ca3af" fontSize={12} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </LightCardContent>
      </LightCard>
    </div>
  );
}
