"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Mail,
  Shield,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCog,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { FloatingActionButton } from "@/components/layout/BottomNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Column } from "@/components/ui/Table";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveList } from "@/components/ui/ResponsiveList";
import { MobileCard, MobileCardAvatar } from "@/components/ui/MobileCard";
import { ResponsiveActionMenu } from "@/components/ui/ActionDrawer";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { useAuth } from "@/lib/auth/context";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { usePortalTeam } from "@/lib/hooks/use-portal";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatDate } from "@/lib/utils";

// Role options
const roleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "BILLING", label: "Billing" },
  { value: "VIEWER", label: "Viewer" },
];

export default function PortalTeamPage() {
  const { hasPermission, activeTenantId, user } = useAuth();
  const toast = useToast();
  const isMobile = useIsMobile();
  const { members, isLoading, refetch } = usePortalTeam();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [isInviting, setIsInviting] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const supabase = createClient();

  const handleInvite = async () => {
    if (!inviteEmail || !activeTenantId) return;

    setIsInviting(true);

    try {
      // Check if user exists
      const { data: existingUser } = await queryWithTimeout(
        supabase
          .from("user_profiles")
          .select("id")
          .eq("email", inviteEmail)
          .single(),
        10000,
        "check existing user"
      );

      if (existingUser) {
        // User exists, create membership
        const { error } = await queryWithTimeout(
          (supabase as any).from("tenant_members").insert({
            tenant_id: activeTenantId,
            user_id: (existingUser as any).id,
            role: inviteRole,
            status: "PENDING_APPROVAL",
          }),
          10000,
          "create tenant membership"
        );

        if (error) throw error;
        toast.success("Invitación enviada. El usuario debe ser aprobado por un admin de Converzia.");
      } else {
        // User doesn't exist, would need to invite via email
        // For now, show a message
        toast.info("El usuario no existe. Cuando se registre podrá solicitar acceso.");
      }

      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("VIEWER");
      refetch();
    } catch (error) {
      toast.error("Error al enviar invitación");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async () => {
    if (!removeId) return;

    try {
      const { error } = await queryWithTimeout(
        (supabase as any)
          .from("tenant_members")
          .update({ status: "REVOKED" })
          .eq("id", removeId),
        10000,
        "revoke tenant membership"
      );

      if (error) throw error;
      toast.success("Miembro removido del equipo");
      setRemoveId(null);
      refetch();
    } catch (error) {
      toast.error("Error al remover miembro");
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await (supabase as any)
        .from("tenant_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;
      toast.success("Rol actualizado");
      refetch();
    } catch (error) {
      toast.error("Error al actualizar rol");
    }
  };

  const canManageUsers = hasPermission("users:manage");
  const canInvite = hasPermission("users:invite");

  const columns: Column<(typeof members)[0]>[] = [
    {
      key: "user",
      header: "Usuario",
      cell: (m) => (
        <UserAvatar
          src={m.user?.avatar_url}
          name={m.user?.full_name || m.user?.email || "Usuario"}
          email={m.user?.email}
        />
      ),
    },
    {
      key: "role",
      header: "Rol",
      cell: (m) => <RoleBadge role={m.role} />,
    },
    {
      key: "status",
      header: "Estado",
      cell: (m) => {
        const config: Record<string, { variant: "success" | "warning" | "danger" | "secondary"; label: string }> = {
          ACTIVE: { variant: "success", label: "Activo" },
          PENDING_APPROVAL: { variant: "warning", label: "Pendiente" },
          SUSPENDED: { variant: "danger", label: "Suspendido" },
          REVOKED: { variant: "secondary", label: "Removido" },
        };
        const c = config[m.status] || { variant: "default" as any, label: m.status };
        return <Badge variant={c.variant} dot>{c.label}</Badge>;
      },
    },
    {
      key: "joined",
      header: "Desde",
      cell: (m) => (
        <span className="text-slate-400 text-sm">{formatDate(m.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      cell: (m) => {
        // Don't show actions for own user or if no permissions
        if (m.user_id === user?.id || !canManageUsers) return null;

        return (
          <ActionDropdown
            items={[
              {
                label: "Cambiar a Admin",
                onClick: () => handleRoleChange(m.id, "ADMIN"),
              },
              {
                label: "Cambiar a Billing",
                onClick: () => handleRoleChange(m.id, "BILLING"),
              },
              {
                label: "Cambiar a Viewer",
                onClick: () => handleRoleChange(m.id, "VIEWER"),
              },
              { divider: true, label: "" },
              {
                label: "Remover del equipo",
                onClick: () => setRemoveId(m.id),
                danger: true,
              },
            ]}
          />
        );
      },
    },
  ];

  const activeMembers = members.filter((m) => m.status === "ACTIVE");
  const pendingMembers = members.filter((m) => m.status === "PENDING_APPROVAL");

  return (
    <PageContainer>
      <PageHeader
        title="Equipo"
        description="Gestioná los miembros de tu equipo"
        actions={
          canInvite && (
            <Button
              onClick={() => setShowInviteModal(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Invitar
            </Button>
          )
        }
      />

      {/* Pending Approvals */}
      {pendingMembers.length > 0 && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              Pendientes de aprobación ({pendingMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-card-border/50"
                >
                  <UserAvatar
                    src={m.user?.avatar_url}
                    name={m.user?.full_name || m.user?.email || "Usuario"}
                    email={m.user?.email}
                  />
                  <div className="flex items-center gap-3">
                    <RoleBadge role={m.role} />
                    <span className="text-sm text-slate-500">
                      Esperando aprobación de Converzia
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros activos ({activeMembers.length})</CardTitle>
        </CardHeader>
        <div className={isMobile ? "p-4" : ""}>
          <ResponsiveList
            data={activeMembers}
            columns={columns}
            keyExtractor={(m) => m.id}
            isLoading={isLoading}
            renderMobileItem={(m) => {
              const statusConfigMap: Record<string, { variant: "success" | "warning" | "danger" | "secondary"; label: string }> = {
                ACTIVE: { variant: "success", label: "Activo" },
                PENDING_APPROVAL: { variant: "warning", label: "Pendiente" },
                SUSPENDED: { variant: "danger", label: "Suspendido" },
                REVOKED: { variant: "secondary", label: "Removido" },
              };
              const c = statusConfigMap[m.status] || { variant: "secondary" as const, label: m.status };
              
              return (
                <MobileCard
                  avatar={
                    <MobileCardAvatar 
                      src={m.user?.avatar_url} 
                      fallback={m.user?.full_name || m.user?.email || "U"}
                      variant="primary"
                    />
                  }
                  title={m.user?.full_name || m.user?.email || "Usuario"}
                  subtitle={m.user?.email}
                  badges={
                    <div className="flex gap-1.5">
                      <RoleBadge role={m.role} />
                      <Badge variant={c.variant} size="sm" dot>{c.label}</Badge>
                    </div>
                  }
                  metadata={`Miembro desde ${formatDate(m.created_at)}`}
                  rightContent={
                    m.user_id !== user?.id && canManageUsers && (
                      <ResponsiveActionMenu
                        title="Opciones de miembro"
                        items={[
                          { label: "Cambiar a Admin", icon: UserCog, onClick: () => handleRoleChange(m.id, "ADMIN") },
                          { label: "Cambiar a Billing", icon: UserCog, onClick: () => handleRoleChange(m.id, "BILLING") },
                          { label: "Cambiar a Viewer", icon: UserCog, onClick: () => handleRoleChange(m.id, "VIEWER") },
                          { divider: true, label: "" },
                          { label: "Remover del equipo", icon: Trash2, onClick: () => setRemoveId(m.id), danger: true },
                        ]}
                      />
                    )
                  }
                  showChevron={false}
                />
              );
            }}
            emptyState={
              <EmptyState
                icon={<Users />}
                title="Sin miembros"
                description="Tu equipo aparecerá aquí cuando invites miembros."
                size="sm"
                action={
                  canInvite
                    ? {
                        label: "Invitar miembro",
                        onClick: () => setShowInviteModal(true),
                      }
                    : undefined
                }
              />
            }
          />
        </div>
      </Card>

      {/* FAB for mobile - Invite */}
      {canInvite && (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          onClick={() => setShowInviteModal(true)}
          label="Invitar"
        />
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invitar miembro"
        description="Ingresá el email del usuario que querés invitar"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleInvite}
              isLoading={isInviting}
              disabled={!inviteEmail}
            >
              Enviar invitación
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="usuario@empresa.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            leftIcon={<Mail className="h-4 w-4" />}
            required
          />
          <Select
            label="Rol"
            options={roleOptions}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          />
        </div>
      </Modal>

      {/* Remove Confirmation */}
      <ConfirmModal
        isOpen={!!removeId}
        onClose={() => setRemoveId(null)}
        onConfirm={handleRemove}
        title="Remover miembro"
        description="¿Estás seguro de que querés remover este miembro del equipo? Perderá acceso inmediatamente."
        confirmText="Remover"
        variant="danger"
      />
    </PageContainer>
  );
}














