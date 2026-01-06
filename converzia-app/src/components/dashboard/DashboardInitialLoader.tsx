"use client";

import { useDashboard } from "@/lib/contexts/dashboard-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/layout/PageHeader";

export function DashboardInitialLoader() {
  const { isInitialLoading } = useDashboard();

  if (!isInitialLoading) {
    return null;
  }

  return (
    <PageContainer>
      <div className="space-y-4 sm:space-y-6 animate-pulse">
        <Skeleton className="h-10 w-48 sm:w-64" />
        <Skeleton className="h-36 sm:h-40 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 sm:h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Skeleton className="h-56 sm:h-64 rounded-2xl" />
          <Skeleton className="h-56 sm:h-64 rounded-2xl" />
        </div>
      </div>
    </PageContainer>
  );
}
