"use client";

import { AdminSidebar, AdminSidebarProvider } from "@/components/layout/AdminSidebar";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { PendingApprovalsProvider } from "@/contexts/PendingApprovalsContext";
import { AdminProvider } from "@/lib/contexts/admin-context";
import { useAdminInitialLoad } from "@/lib/hooks/use-admin-initial-load";
import { useAdminPolling } from "@/lib/hooks/use-admin-polling";
import { SidebarInset } from "@/components/ui/sidebar";
import { SuspenseBoundary } from "@/components/ui/loading/SuspenseBoundary";

function AdminInitializer() {
  useAdminInitialLoad();
  useAdminPolling();
  return null;
}

function AdminContent({ children }: { children: React.ReactNode }) {
  // Always show content immediately - no blocking
  // Individual components will show their own skeletons
  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminInitializer />
      <PendingApprovalsProvider>
        <AdminSidebarProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AdminSidebar />
            <SidebarInset className="flex flex-col">
              <AdminHeader />
              {/* Main content with padding for mobile bottom nav */}
              <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom,0px))] lg:pb-0">
                <SuspenseBoundary>
                  <AdminContent>{children}</AdminContent>
                </SuspenseBoundary>
              </main>
            </SidebarInset>
          </div>
        </AdminSidebarProvider>
      </PendingApprovalsProvider>
    </AdminProvider>
  );
}
