import { PortalSidebar } from "@/components/layout/PortalSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <PortalSidebar />
      <div className="lg:ml-64">
        <PortalHeader />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}



