"use client";

import { useState } from "react";
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
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Avatar, UserAvatar } from "@/components/ui/Avatar";
import { ActionDropdown } from "@/components/ui/Dropdown";
import { ConfirmModal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useUsers, usePendingApprovals, useUserMutations } from "@/lib/hooks/use-users";
import { formatRelativeTime, formatDate } from "@/lib/utils";

export default function UsersPage() {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adminFilter, setAdminFilter] = useState<boolean | undefined>(undefined);

  const { users, total, isLoading, refetch } = useUsers({
    search,
    isAdmin: adminFilter,
    page,
    pageSize: 20,
  });

  const { approvals, total: approvalsCount, isLoading: loadingApprovals, refetch: refetchApprovals } = usePendingApprovals();
  const { approveMembership, rejectMembership, setConverziaAdmin, isLoading: isMutating } = useUserMutations();

  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

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
      key: "role",
      header: "Rol",
      cell: (u) => (
        <div className="flex items-center gap-2">
          {u.is_converzia_admin && (
            <Badge variant="primary">
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          )}
          {u.memberships.length > 0 && (
            <span className="text-sm text-slate-500">
              {u.memberships.length} tenant{u.memberships.length > 1 ? "s" : ""}
            </span>
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
            <span className="text-slate-500 text-sm">Sin tenants</span>
          )}
        </div>
      ),
    },
    {
      key: "created",
      header: "Registrado",
      cell: (u) => (
        <span className="text-slate-400 text-sm">{formatDate(u.created_at)}</span>
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
              onClick: () => {},
            },
            u.is_converzia_admin
              ? {
                  label: "Remover admin",
                  onClick: () => handleToggleAdmin(u.id, true),
                  danger: true,
                }
              : {
                  label: "Hacer admin",
                  onClick: () => handleToggleAdmin(u.id, false),
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
          <Building2 className="h-4 w-4 text-slate-500" />
          <span className="text-white">{a.tenant?.name}</span>
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
        <div className="flex items-center gap-2 text-slate-400 text-sm">
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
            <DataTable
              data={approvals}
              columns={approvalColumns}
              keyExtractor={(a) => a.id}
              isLoading={loadingApprovals}
              emptyState={
                <EmptyState
                  icon={<Check />}
                  title="Sin solicitudes pendientes"
                  description="No hay solicitudes de acceso esperando aprobación."
                  size="sm"
                />
              }
            />
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
                <div className="flex items-center gap-2">
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
                          : "text-slate-400 hover:text-white hover:bg-card-border"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DataTable
              data={users}
              columns={userColumns}
              keyExtractor={(u) => u.id}
              isLoading={isLoading}
              emptyState={
                <EmptyState
                  icon={<Users />}
                  title="Sin usuarios"
                  description="No hay usuarios registrados en la plataforma."
                  size="sm"
                />
              }
            />
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
    </PageContainer>
  );
}




