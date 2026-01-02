"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Shield,
  Check,
  X,
  Clock,
  Building2,
  Mail,
  UserCog,
  Eye,
  Trash2,
  Home,
  Car,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { CustomSelect } from "@/components/ui/Select";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Avatar, UserAvatar } from "@/components/ui/Avatar";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveList } from "@/components/ui/ResponsiveList";
import { MobileCard, MobileCardAvatar } from "@/components/ui/MobileCard";
import { ResponsiveActionMenu } from "@/components/ui/ActionDrawer";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { QuickFilters, FilterDrawer, FilterSection, FilterChips } from "@/components/ui/FilterDrawer";
import { useUsers, useUserMutations } from "@/lib/hooks/use-users";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { usePendingApprovalsContext } from "@/contexts/PendingApprovalsContext";
import { formatRelativeTime, formatDate } from "@/lib/utils";

const VERTICAL_OPTIONS = [
  { value: "", label: "Todas las verticales" },
  { value: "CONVERZIA", label: "Converzia (Admins)" },
  { value: "PROPERTY", label: "Inmobiliaria" },
  { value: "AUTO", label: "Automotriz" },
  { value: "LOAN", label: "Créditos" },
  { value: "INSURANCE", label: "Seguros" },
];

const VERTICAL_LABELS: Record<string, string> = {
  PROPERTY: "Inmobiliaria",
  AUTO: "Automotriz",
  LOAN: "Créditos",
  INSURANCE: "Seguros",
};

const VERTICAL_ICONS: Record<string, React.ReactNode> = {
  PROPERTY: <Home className="h-3 w-3" />,
  AUTO: <Car className="h-3 w-3" />,
  LOAN: <Wallet className="h-3 w-3" />,
  INSURANCE: <ShieldCheck className="h-3 w-3" />,
};

export default function UsersPage() {
  const router = useRouter();
  const toast = useToast();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adminFilter, setAdminFilter] = useState<boolean | undefined>(undefined);
  const [verticalFilter, setVerticalFilter] = useState<string>("");

  const { users, total, isLoading, refetch } = useUsers({
    search,
    isAdmin: adminFilter,
    vertical: verticalFilter || undefined,
    page,
    pageSize: 20,
  });

  const { approvals, total: approvalsCount, isLoading: loadingApprovals, refetch: refetchApprovals } = usePendingApprovalsContext();
  const { approveMembership, rejectMembership, setConverziaAdmin, deleteUser, isLoading: isMutating } = useUserMutations();

  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [viewUser, setViewUser] = useState<(typeof users)[0] | null>(null);

  const handleApprove = async () => {
    if (!approveId) return;
    try {
      await approveMembership(approveId);
      toast.success("Usuario aprobado correctamente");
      setApproveId(null);
      refetchApprovals();
    } catch (error) {
      toast.error("Error al aprobar usuario");
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    try {
      await rejectMembership(rejectId);
      toast.success("Solicitud rechazada");
      setRejectId(null);
      refetchApprovals();
    } catch (error) {
      toast.error("Error al rechazar solicitud");
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      await setConverziaAdmin(userId, !currentStatus);
      toast.success(!currentStatus ? "Usuario promovido a admin" : "Permisos de admin removidos");
      refetch();
    } catch (error) {
      toast.error("Error al cambiar permisos");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await deleteUser(deleteUserId);
      toast.success("Usuario eliminado correctamente");
      setDeleteUserId(null);
      refetch();
    } catch (error) {
      toast.error("Error al eliminar usuario");
    }
  };

  // Helper to get unique verticals from user's memberships
  const getUserVerticals = (u: (typeof users)[0]) => {
    const verticals = new Set<string>();
    u.memberships.forEach((m) => {
      if (m.tenant?.vertical) {
        verticals.add(m.tenant.vertical);
      }
    });
    return Array.from(verticals);
  };

  // Users table columns
  const userColumns: Column<(typeof users)[0]>[] = [
    {
      key: "user",
      header: "Usuario",
      cell: (u) => (
        <UserAvatar
          src={u.avatar_url}
          name={u.full_name || u.email}
          email={u.email}
        />
      ),
    },
    {
      key: "profile",
      header: "Perfil",
      cell: (u) => {
        if (u.is_converzia_admin) {
          return (
            <Badge variant="primary">
              <Shield className="h-3 w-3 mr-1" />
              Converzia Admin
            </Badge>
          );
        }
        if (u.memberships.length > 0) {
          const verticals = getUserVerticals(u);
          if (verticals.length === 0) {
            return (
              <Badge variant="secondary">
                <Building2 className="h-3 w-3 mr-1" />
                Usuario Tenant
              </Badge>
            );
          }
          return (
            <div className="flex flex-wrap gap-1">
              {verticals.map((v) => (
                <Badge key={v} variant="secondary" size="sm">
                  {VERTICAL_ICONS[v]}
                  <span className="ml-1">{VERTICAL_LABELS[v] || v}</span>
                </Badge>
              ))}
            </div>
          );
        }
        return <span className="text-[var(--text-tertiary)] text-sm">Sin asignar</span>;
      },
    },
    {
      key: "role",
      header: "Rol",
      cell: (u) => (
        <div className="flex items-center gap-2">
          {u.memberships.length > 0 ? (
            <span className="text-sm text-[var(--text-secondary)]">
              {u.memberships.length} tenant{u.memberships.length > 1 ? "s" : ""}
            </span>
          ) : u.is_converzia_admin ? (
            <span className="text-sm text-[var(--text-tertiary)]">Admin global</span>
          ) : (
            <span className="text-sm text-[var(--text-tertiary)]">-</span>
          )}
        </div>
      ),
    },
    {
      key: "memberships",
      header: "Tenants",
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.memberships.slice(0, 3).map((m) => (
            <Badge key={m.id} variant="secondary" size="sm">
              {m.tenant?.name}
            </Badge>
          ))}
          {u.memberships.length > 3 && (
            <Badge variant="default" size="sm">
              +{u.memberships.length - 3}
            </Badge>
          )}
          {u.memberships.length === 0 && (
            <span className="text-[var(--text-tertiary)] text-sm">Sin tenants</span>
          )}
        </div>
      ),
    },
    {
      key: "created",
      header: "Registrado",
      cell: (u) => (
        <span className="text-[var(--text-tertiary)] text-sm">{formatDate(u.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      cell: (u) => (
        <ActionDropdown
          items={[
            {
              label: "Ver perfil",
              icon: <Eye className="h-4 w-4" />,
              onClick: () => setViewUser(u),
            },
            u.is_converzia_admin
              ? {
                  label: "Remover admin",
                  icon: <Shield className="h-4 w-4" />,
                  onClick: () => handleToggleAdmin(u.id, true),
                  danger: true,
                }
              : {
                  label: "Hacer admin",
                  icon: <Shield className="h-4 w-4" />,
                  onClick: () => handleToggleAdmin(u.id, false),
                },
            {
              label: "Eliminar usuario",
              icon: <Trash2 className="h-4 w-4" />,
              onClick: () => setDeleteUserId(u.id),
              danger: true,
            },
          ]}
        />
      ),
    },
  ];

  // Approvals table columns
  const approvalColumns: Column<(typeof approvals)[0]>[] = [
    {
      key: "user",
      header: "Usuario",
      cell: (a) => (
        <UserAvatar
          name={a.user?.full_name || a.user?.email || "Usuario"}
          email={a.user?.email}
        />
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (a) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--text-tertiary)]" />
          <span className="text-[var(--text-primary)]">{a.tenant?.name}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol solicitado",
      cell: (a) => <RoleBadge role={a.role} />,
    },
    {
      key: "requested",
      header: "Solicitado",
      cell: (a) => (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-sm">
          <Clock className="h-4 w-4" />
          {formatRelativeTime(a.created_at)}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "140px",
      cell: (a) => (
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="success"
            onClick={() => setApproveId(a.id)}
            leftIcon={<Check className="h-3 w-3" />}
          >
            Aprobar
          </Button>
          <Button
            size="xs"
            variant="danger"
            onClick={() => setRejectId(a.id)}
            leftIcon={<X className="h-3 w-3" />}
          >
            Rechazar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Usuarios"
        description="Gestiona usuarios y aprobaciones de acceso"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Usuarios" },
        ]}
      />

      <Tabs defaultValue="approvals">
        <TabsList>
          <TabTrigger value="approvals" count={approvalsCount}>
            Pendientes
          </TabTrigger>
          <TabTrigger value="users" count={total}>
            Todos los usuarios
          </TabTrigger>
        </TabsList>

        {/* Pending Approvals */}
        <TabContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes pendientes de aprobación</CardTitle>
            </CardHeader>
            <div className={isMobile ? "p-4" : ""}>
              <ResponsiveList
                data={approvals}
                columns={approvalColumns}
                keyExtractor={(a) => a.id}
                isLoading={loadingApprovals}
                renderMobileItem={(a) => (
                  <MobileCard
                    avatar={
                      <MobileCardAvatar 
                        fallback={a.user?.full_name || a.user?.email || "U"}
                        variant="warning"
                      />
                    }
                    title={a.user?.full_name || a.user?.email || "Usuario"}
                    subtitle={a.tenant?.name}
                    badges={<RoleBadge role={a.role} />}
                    metadata={formatRelativeTime(a.created_at)}
                    footer={
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => setApproveId(a.id)}
                          leftIcon={<Check className="h-3 w-3" />}
                          className="flex-1"
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejectId(a.id)}
                          leftIcon={<X className="h-3 w-3" />}
                          className="flex-1"
                        >
                          Rechazar
                        </Button>
                      </div>
                    }
                    showChevron={false}
                  />
                )}
                emptyState={
                  <EmptyState
                    icon={<Check />}
                    title="Sin solicitudes pendientes"
                    description="No hay solicitudes de acceso esperando aprobación."
                    size="sm"
                  />
                }
              />
            </div>
          </Card>
        </TabContent>

        {/* All Users */}
        <TabContent value="users">
          <Card>
            <div className="p-4 border-b border-card-border">
              <div className="flex flex-col sm:flex-row gap-4">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar por nombre o email..."
                  className="flex-1 max-w-md"
                />
                <div className="flex items-center gap-3">
                  {/* Vertical filter */}
                  <CustomSelect
                    value={verticalFilter}
                    onChange={setVerticalFilter}
                    options={VERTICAL_OPTIONS}
                    placeholder="Vertical"
                    className="w-48"
                  />
                  {/* Admin filter buttons */}
                  <div className="flex items-center gap-1">
                    {[
                      { value: undefined, label: "Todos" },
                      { value: true, label: "Admins" },
                      { value: false, label: "Usuarios" },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => setAdminFilter(opt.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          adminFilter === opt.value
                            ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-card-border"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className={isMobile ? "p-4" : ""}>
              <ResponsiveList
                data={users}
                columns={userColumns}
                keyExtractor={(u) => u.id}
                isLoading={isLoading}
                renderMobileItem={(u) => {
                  const verticals = getUserVerticals(u);
                  
                  return (
                    <MobileCard
                      avatar={
                        <MobileCardAvatar 
                          src={u.avatar_url}
                          fallback={u.full_name || u.email}
                          variant={u.is_converzia_admin ? "primary" : "default"}
                        />
                      }
                      title={u.full_name || "Sin nombre"}
                      subtitle={u.email}
                      badges={
                        <div className="flex flex-wrap gap-1">
                          {u.is_converzia_admin && (
                            <Badge variant="primary" size="sm">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {verticals.slice(0, 2).map((v) => (
                            <Badge key={v} variant="secondary" size="sm">
                              {VERTICAL_ICONS[v]}
                              <span className="ml-1">{VERTICAL_LABELS[v] || v}</span>
                            </Badge>
                          ))}
                          {u.memberships.length > 0 && !u.is_converzia_admin && verticals.length === 0 && (
                            <Badge variant="secondary" size="sm">
                              <Building2 className="h-3 w-3 mr-1" />
                              {u.memberships.length} tenant{u.memberships.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      }
                      metadata={`Registrado ${formatDate(u.created_at)}`}
                      rightContent={
                        <ResponsiveActionMenu
                          title="Opciones de usuario"
                          items={[
                            { label: "Ver perfil", icon: Eye, onClick: () => setViewUser(u) },
                            u.is_converzia_admin
                              ? { label: "Remover admin", icon: Shield, onClick: () => handleToggleAdmin(u.id, true), danger: true }
                              : { label: "Hacer admin", icon: Shield, onClick: () => handleToggleAdmin(u.id, false) },
                            { divider: true, label: "" },
                            { label: "Eliminar usuario", icon: Trash2, onClick: () => setDeleteUserId(u.id), danger: true },
                          ]}
                        />
                      }
                      showChevron={false}
                      onPress={() => setViewUser(u)}
                    />
                  );
                }}
                emptyState={
                  <EmptyState
                    icon={<Users />}
                    title="Sin usuarios"
                    description="No hay usuarios registrados en la plataforma."
                    size="sm"
                  />
                }
              />
            </div>
            {total > 20 && (
              <div className="p-4 border-t border-card-border">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(total / 20)}
                  totalItems={total}
                  pageSize={20}
                  onPageChange={setPage}
                />
              </div>
            )}
          </Card>
        </TabContent>
      </Tabs>

      {/* Approve Modal */}
      <ConfirmModal
        isOpen={!!approveId}
        onClose={() => setApproveId(null)}
        onConfirm={handleApprove}
        title="Aprobar acceso"
        description="El usuario podrá acceder al tenant con el rol solicitado."
        confirmText="Aprobar"
        isLoading={isMutating}
      />

      {/* Reject Modal */}
      <ConfirmModal
        isOpen={!!rejectId}
        onClose={() => setRejectId(null)}
        onConfirm={handleReject}
        title="Rechazar solicitud"
        description="La solicitud de acceso será rechazada."
        confirmText="Rechazar"
        variant="danger"
        isLoading={isMutating}
      />

      {/* Delete User Modal */}
      <ConfirmModal
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={handleDeleteUser}
        title="Eliminar usuario"
        description="Se eliminarán el perfil del usuario y todas sus membresías. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
        isLoading={isMutating}
      />

      {/* View User Profile Modal */}
      <Modal
        isOpen={!!viewUser}
        onClose={() => setViewUser(null)}
        title="Perfil de usuario"
        size="lg"
      >
        {viewUser && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center">
                <span className="text-2xl font-semibold text-[var(--accent-primary)]">
                  {(viewUser.full_name || viewUser.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {viewUser.full_name || "Sin nombre"}
                </h3>
                <p className="text-[var(--text-secondary)]">{viewUser.email}</p>
                {viewUser.is_converzia_admin && (
                  <Badge variant="primary" className="mt-1">
                    <Shield className="h-3 w-3 mr-1" />
                    Administrador Converzia
                  </Badge>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Registrado</p>
                <p className="text-sm text-[var(--text-primary)]">{formatDate(viewUser.created_at)}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Última actualización</p>
                <p className="text-sm text-[var(--text-primary)]">{formatDate(viewUser.updated_at)}</p>
              </div>
            </div>

            {/* Memberships */}
            <div>
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">Membresías de Tenants</h4>
              {viewUser.memberships.length > 0 ? (
                <div className="space-y-2">
                  {viewUser.memberships.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[var(--text-tertiary)]" />
                        <span className="text-sm text-[var(--text-primary)]">{m.tenant?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={m.role} />
                        <Badge variant={m.status === "ACTIVE" ? "success" : "secondary"} size="sm">
                          {m.status === "ACTIVE" ? "Activo" : m.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-tertiary)]">Sin membresías en tenants</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}









