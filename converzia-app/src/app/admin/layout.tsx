"use client";

import { AdminSidebar, AdminSidebarProvider } from "@/components/layout/AdminSidebar";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { PendingApprovalsProvider } from "@/contexts/PendingApprovalsContext";
import { SidebarInset } from "@/components/ui/sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PendingApprovalsProvider>
      <AdminSidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        
          <SidebarInset className="flex flex-col">
          <AdminHeader />
          
          {/* Main content with padding for mobile bottom nav */}
          <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom,0px))] lg:pb-0">
            {children}
          </main>
          </SidebarInset>
        </div>
      </AdminSidebarProvider>
    </PendingApprovalsProvider>
  );
}
