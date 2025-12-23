import { PortalSidebar } from "@/components/layout/PortalSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <PortalSidebar />
      
      {/* Main content area - shifts right on desktop */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <PortalHeader />
        
        {/* Main content with padding for mobile bottom nav */}
        <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom,0px))] lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
