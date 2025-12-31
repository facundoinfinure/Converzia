import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { PendingApprovalsProvider } from "@/contexts/PendingApprovalsContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PendingApprovalsProvider>
      <div className="min-h-screen bg-[var(--bg-secondary)]">
        <AdminSidebar />
        
        {/* Main content area - shifts right on desktop */}
        <div className="lg:ml-64 flex flex-col min-h-screen">
          <AdminHeader />
          
          {/* Main content with padding for mobile bottom nav */}
          <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom,0px))] lg:pb-0">
            {children}
          </main>
        </div>
      </div>
    </PendingApprovalsProvider>
  );
}
