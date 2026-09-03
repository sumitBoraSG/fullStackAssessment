import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Send,
  Loader2,
  ShieldCheck,
  Stethoscope,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Plus,
  X,
  Copy,
  Check,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  FileSpreadsheet,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  inviteUserApi,
  getAllInvitationsApi,
  revokeInvitationApi,
} from "../../api/adminApi";
import { BulkInviteModal } from "../../components/admin/BulkInviteModal";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Alert } from "../../components/ui/Alert";
import { EmptyState } from "../../components/ui/EmptyState";
import type {
  UserRole,
  InvitationItem,
  InvitationStatus,
  PaginationMeta,
} from "../../types/auth";

export const AdminInvitationsPage: React.FC = () => {
  const { setNotification } = useAuth();

  // Table Data & Pagination State
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Server-side Filters & Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Single Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<UserRole>("DOCTOR");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [inviteErrors, setInviteErrors] = useState<{ email?: string; role?: string }>({});

  // Bulk Invite Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);

  // Revoke Confirmation Modal State
  const [revokeTarget, setRevokeTarget] = useState<InvitationItem | null>(null);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Clipboard copy state
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  // Debounce search input changes by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch invitations function from backend
  const fetchInvitations = useCallback(
    async (
      pageToFetch: number,
      limitToFetch: number,
      searchToFetch: string,
      statusToFetch: string,
      roleToFetch: string,
      isSilentRefresh = false
    ) => {
      if (!isSilentRefresh) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setFetchError(null);

      const res = await getAllInvitationsApi({
        page: pageToFetch,
        limit: limitToFetch,
        search: searchToFetch.trim() || undefined,
        status: statusToFetch !== "ALL" ? (statusToFetch as InvitationStatus) : undefined,
        role: roleToFetch !== "ALL" ? (roleToFetch as UserRole) : undefined,
      });

      if (res.success && res.data) {
        setInvitations(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        const errorMsg =
          res.error?.message ||
          res.message ||
          "Unable to load invitations from the server.";
        setFetchError(errorMsg);
        setNotification({
          type: "error",
          message: errorMsg,
        });
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [setNotification]
  );

  // When debounced search, status filter, or role filter change, reset to page 1
  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [debouncedSearch, statusFilter, roleFilter]);

  // Fetch invitations on page, limit, search, or filter changes
  useEffect(() => {
    fetchInvitations(
      pagination.page,
      pagination.limit,
      debouncedSearch,
      statusFilter,
      roleFilter
    );
  }, [
    fetchInvitations,
    pagination.page,
    pagination.limit,
    debouncedSearch,
    statusFilter,
    roleFilter,
  ]);

  // Handle page navigation
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.page) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  // Check if any filter is active
  const hasActiveFilters =
    searchQuery.trim() !== "" || statusFilter !== "ALL" || roleFilter !== "ALL";

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
  };

  // Copy email to clipboard
  const handleCopyEmail = (emailToCopy: string, id: string | number) => {
    navigator.clipboard.writeText(emailToCopy);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Helper date formatter
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Check expiration status relative to now
  const getRelativeExpiry = (expiresAt: string, status: InvitationStatus) => {
    if (status !== "PENDING") return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return "Expired";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Expires in ${days}d`;
    }
    if (hours > 0) {
      return `Expires in ${hours}h ${mins}m`;
    }
    return `Expires in ${mins}m`;
  };

  // Render Role Badges
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case "DOCTOR":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            <Stethoscope className="w-3 h-3 text-[#141413]/70" />
            Doctor
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            <ShieldCheck className="w-3 h-3 text-[#141413]/70" />
            Admin
          </span>
        );
      case "PATIENT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            <User className="w-3 h-3 text-[#141413]/70" />
            Patient
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            {role}
          </span>
        );
    }
  };

  // Render Status Badges
  const renderStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#EAE0CE] text-[#4A3B18] border border-[#D4C4A8]">
            <Clock className="w-3 h-3 text-[#7A5B18]" />
            Pending
          </span>
        );
      case "USED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#DCE7DD] text-[#1E3E26] border border-[#BED4C1]">
            <CheckCircle2 className="w-3 h-3 text-[#265330]" />
            Accepted
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#DDD7CA] text-[#2D2A24] border border-[#CCC4B4]">
            <AlertCircle className="w-3 h-3 text-[#4D483F]" />
            Expired
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#EEDCDA] text-[#541C18] border border-[#DEC0BD]">
            <XCircle className="w-3 h-3 text-[#7A2420]" />
            Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#DDD7CA] text-[#2D2A24] border border-[#CCC4B4]">
            {status}
          </span>
        );
    }
  };

  // Single Invite Modal Form Handling
  const validateInvite = (): boolean => {
    const errors: { email?: string; role?: string } = {};
    const trimmedEmail = inviteEmail.trim();

    if (!trimmedEmail) {
      errors.email = "Recipient email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address";
    }

    if (!inviteRole) {
      errors.role = "User role is required.";
    }

    setInviteErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateInvite()) return;

    setIsSubmitting(true);
    const res = await inviteUserApi(inviteEmail.trim(), inviteRole);
    setIsSubmitting(false);

    if (res.success && res.data) {
      setNotification({
        type: "success",
        message: res.message || `Invitation sent successfully to ${inviteEmail.trim()}`,
      });
      setInviteEmail("");
      setInviteErrors({});
      setIsInviteModalOpen(false);
      fetchInvitations(1, pagination.limit, debouncedSearch, statusFilter, roleFilter, true);
    } else {
      const errMsg =
        res.error?.message || res.message || "Failed to send invitation.";
      setNotification({
        type: "error",
        message: errMsg,
      });
      setInviteErrors({ email: errMsg });
    }
  };

  // Revoke modal handling
  const handleOpenRevokeModal = (invitation: InvitationItem) => {
    setRevokeTarget(invitation);
    setRevokeError(null);
  };

  const handleCloseRevokeModal = () => {
    if (isRevoking) return;
    setRevokeTarget(null);
    setRevokeError(null);
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget || isRevoking) return;

    setIsRevoking(true);
    setRevokeError(null);

    const res = await revokeInvitationApi(revokeTarget.id);
    setIsRevoking(false);

    if (res.success) {
      setNotification({
        type: "success",
        message: res.message || `Invitation for ${revokeTarget.email} was successfully revoked.`,
      });
      setRevokeTarget(null);
      fetchInvitations(
        pagination.page,
        pagination.limit,
        debouncedSearch,
        statusFilter,
        roleFilter,
        true
      );
    } else {
      const errMsg =
        res.error?.message ||
        res.message ||
        "Failed to revoke invitation. Please try again.";
      setRevokeError(errMsg);
      setNotification({
        type: "error",
        message: errMsg,
      });
    }
  };

  // Helper for generating pagination range
  const getPaginationRange = () => {
    const total = pagination.totalPages;
    const current = pagination.page;
    const delta = 1;
    const range: (number | string)[] = [];

    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      ) {
        range.push(i);
      } else if (range[range.length - 1] !== "...") {
        range.push("...");
      }
    }
    return range;
  };

  const startRecord =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Editorial Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]/60 block mb-1">
            Administrative Control
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#141413] tracking-tight m-0">
            Invitations
          </h1>
          <p className="text-xs sm:text-sm text-[#141413]/60 mt-1 max-w-xl leading-relaxed">
            Manage, monitor, and issue registration invitations for practitioners and patients.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Refresh Action */}
          <Button
            variant="secondary"
            onClick={() =>
              fetchInvitations(
                pagination.page,
                pagination.limit,
                debouncedSearch,
                statusFilter,
                roleFilter,
                true
              )
            }
            disabled={isLoading}
            isLoading={isRefreshing}
            title="Refresh table"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshing ? "animate-spin text-[#141413]" : "text-[#141413]/60"
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Bulk Invite Action */}
          <Button
            variant="secondary"
            onClick={() => setIsBulkModalOpen(true)}
            title="Upload CSV for bulk invitations"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Bulk Invite</span>
          </Button>

          {/* Single Invite Action */}
          <Button variant="primary" onClick={() => setIsInviteModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Invite User</span>
          </Button>
        </div>
      </div>

      {/* Unified Search & Filters Toolbar */}
      <div className="bg-[#E3DBCC] rounded-xl border border-[#D8D0BF] p-3 sm:p-4 shadow-xs text-[#141413]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#141413]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by recipient email..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] placeholder-[#141413]/40 focus:outline-none focus:border-[#141413] shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedSearch("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#141413]/40 hover:text-[#141413] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Reset */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#141413]/50" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-[#FAF8F5] border border-[#D8D0BF] rounded-lg px-2.5 py-1.5 text-[#141413] font-medium focus:outline-none focus:border-[#141413] shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="USED">Accepted (Used)</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs bg-[#FAF8F5] border border-[#D8D0BF] rounded-lg px-2.5 py-1.5 text-[#141413] font-medium focus:outline-none focus:border-[#141413] shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="DOCTOR">Doctor</option>
                <option value="PATIENT">Patient</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {/* Rows Per Page */}
            <div className="flex items-center gap-1.5 text-xs text-[#141413]/60 pl-1 border-l border-[#D8D0BF]">
              <span className="hidden sm:inline font-medium">Rows:</span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="text-xs bg-[#FAF8F5] border border-[#D8D0BF] rounded-lg px-2 py-1.5 text-[#141413] font-medium focus:outline-none focus:border-[#141413] shadow-2xs cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#E3DBCC] text-[#141413] text-xs font-medium border border-[#D8D0BF] transition-colors cursor-pointer shadow-2xs"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#E3DBCC] rounded-xl border border-[#D8D0BF] shadow-xs overflow-hidden text-[#141413]">
        {/* Error State Banner */}
        {fetchError && !isLoading && (
          <div className="m-4 space-y-3">
            <Alert variant="error" title="Failed to load invitations">
              {fetchError}
            </Alert>
            <Button
              variant="danger"
              onClick={() =>
                fetchInvitations(
                  pagination.page,
                  pagination.limit,
                  debouncedSearch,
                  statusFilter,
                  roleFilter
                )
              }
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-16 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#141413] m-0">Loading invitations...</p>
              <p className="text-[11px] text-[#141413]/50 mt-0.5 m-0">Fetching records from server</p>
            </div>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !fetchError && invitations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8D0BF] bg-[#FAF8F5] text-[10px] font-semibold text-[#141413]/70 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Recipient Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 sm:px-6">Expiry Date</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8D0BF]/60 text-xs">
                {invitations.map((invitation) => {
                  const isCopied = copiedId === invitation.id;
                  const relativeExpiry = getRelativeExpiry(invitation.expiresAt, invitation.status);
                  const canRevoke = invitation.status !== "USED" && invitation.status !== "REVOKED";

                  return (
                    <tr
                      key={invitation.id}
                      className="hover:bg-[#FAF8F5]/60 transition-colors group"
                    >
                      {/* Email Column */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-[#141413] text-[#F0EEE6] flex items-center justify-center font-semibold text-xs uppercase shrink-0">
                            {invitation.email.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#141413] truncate">
                                {invitation.email}
                              </span>
                              <button
                                onClick={() => handleCopyEmail(invitation.email, invitation.id)}
                                className="p-1 rounded-md text-[#141413]/40 hover:text-[#141413] hover:bg-[#FAF8F5] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Copy email address"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-[#2B5438]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-[#141413]/50 block font-mono">
                              ID #{invitation.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Column */}
                      <td className="py-3.5 px-4">
                        {renderRoleBadge(invitation.role)}
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(invitation.status)}
                      </td>

                      {/* Created Date Column */}
                      <td className="py-3.5 px-4 text-[#141413]/70">
                        <span className="block font-medium">
                          {formatDate(invitation.createdAt)}
                        </span>
                      </td>

                      {/* Expiry Date Column */}
                      <td className="py-3.5 px-4 sm:px-6 text-[#141413]/70">
                        <div className="space-y-0.5">
                          <span className="block font-medium">
                            {formatDate(invitation.expiresAt)}
                          </span>
                          {relativeExpiry && (
                            <span className="text-[10px] font-semibold text-[#7A5B18] block">
                              {relativeExpiry}
                            </span>
                          )}
                          {invitation.usedAt && (
                            <span className="text-[10px] font-medium text-[#1E3E26] block">
                              Used on {formatDate(invitation.usedAt)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        {canRevoke ? (
                          <button
                            onClick={() => handleOpenRevokeModal(invitation)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#EEDCDA] hover:bg-[#E5C9C6] active:bg-[#DDB8B4] text-[#541C18] border border-[#DEC0BD] shadow-2xs transition-all cursor-pointer"
                            title="Revoke invitation"
                          >
                            <Ban className="w-3.5 h-3.5 text-[#7A2420]" />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <span className="text-xs text-[#141413]/30 select-none px-2 py-1">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !fetchError && invitations.length === 0 && (
          <EmptyState
            icon={Inbox}
            color="stone"
            title="No invitations found"
            description={
              hasActiveFilters
                ? "No invitations match your search and filter criteria. Try resetting filters."
                : "No invitations have been issued yet. Send your first invitation to get started."
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={handleResetFilters}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setIsInviteModalOpen(true)}>
                  <Plus className="w-4 h-4" />
                  <span>Invite New User</span>
                </Button>
              )
            }
          />
        )}

        {/* Pagination Footer */}
        {!isLoading && !fetchError && pagination.total > 0 && (
          <div className="p-3.5 sm:px-6 border-t border-[#D8D0BF] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#141413]/70">
            <div>
              Showing <span className="font-semibold text-[#141413]">{startRecord}</span> to{" "}
              <span className="font-semibold text-[#141413]">{endRecord}</span> of{" "}
              <span className="font-semibold text-[#141413]">{pagination.total}</span> invitations
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
                className="p-1.5 rounded-lg border border-[#D8D0BF] bg-[#FAF8F5] hover:bg-[#E3DBCC] text-[#141413] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-1.5 rounded-lg border border-[#D8D0BF] bg-[#FAF8F5] hover:bg-[#E3DBCC] text-[#141413] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 mx-1">
                {getPaginationRange().map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-[#141413]/40 select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === pagination.page;
                  return (
                    <button
                      key={`page-${p}`}
                      onClick={() => handlePageChange(Number(p))}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-[#141413] text-[#F0EEE6] shadow-2xs"
                          : "border border-[#D8D0BF] bg-[#FAF8F5] hover:bg-[#E3DBCC] text-[#141413]"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-[#D8D0BF] bg-[#FAF8F5] hover:bg-[#E3DBCC] text-[#141413] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-[#D8D0BF] bg-[#FAF8F5] hover:bg-[#E3DBCC] text-[#141413] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        icon={Mail}
        iconColor="amber"
        title="Invite New User"
        description="Send single onboarding registration link"
        disableClose={isSubmitting}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsInviteModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="single-invite-form"
              variant="primary"
              isLoading={isSubmitting}
              loadingText="Sending Invitation..."
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Invitation</span>
            </Button>
          </>
        }
      >
        {/* Modal Form */}
        <form id="single-invite-form" onSubmit={handleSendInvite} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-semibold text-[#141413] mb-1">
              Email Address <span className="text-[#8E2A22]">*</span>
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="e.g. practitioner@docpulse.com"
              disabled={isSubmitting}
              className={`w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-[#FAF8F5] border text-[#141413] placeholder-[#141413]/40 focus:outline-none focus:border-[#141413] transition-all ${
                inviteErrors.email
                  ? "border-[#8E2A22] text-[#8E2A22]"
                  : "border-[#D8D0BF]"
              }`}
            />
            {inviteErrors.email && (
              <p className="text-xs text-[#8E2A22] mt-1 font-medium m-0">
                {inviteErrors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#141413] mb-1.5">
              Assign Role <span className="text-[#8E2A22]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "DOCTOR" as UserRole, label: "Doctor", icon: Stethoscope },
                { id: "PATIENT" as UserRole, label: "Patient", icon: User },
                { id: "ADMIN" as UserRole, label: "Admin", icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = inviteRole === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setInviteRole(item.id)}
                    disabled={isSubmitting}
                    className={`p-2.5 rounded-lg border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#141413] text-[#F0EEE6] border-[#141413] shadow-xs"
                        : "bg-[#FAF8F5] border-[#D8D0BF] text-[#141413] hover:bg-[#E3DBCC]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-[#F0EEE6]" : "text-[#141413]/60"}`} />
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#F0EEE6]" />}
                    </div>
                    <span className="text-xs font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[11px] text-[#141413]/60 flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 text-[#141413]/40 shrink-0 mt-0.5" />
            <span>
              The invitation link will automatically expire in 24 hours. The recipient will be invited to set their password.
            </span>
          </div>
        </form>
      </Modal>

      {/* Revoke Confirmation Modal */}
      {revokeTarget && (
        <Modal
          isOpen={true}
          onClose={handleCloseRevokeModal}
          icon={Ban}
          iconColor="rose"
          title="Revoke Invitation"
          description="Immediately invalidate registration access"
          disableClose={isRevoking}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseRevokeModal}
                disabled={isRevoking}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmRevoke}
                isLoading={isRevoking}
                loadingText="Revoking..."
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Confirm Revoke</span>
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {revokeError && <Alert variant="error">{revokeError}</Alert>}

            <p className="text-xs text-[#141413]/70 leading-relaxed m-0">
              Are you sure you want to revoke the registration invitation for{" "}
              <span className="font-semibold text-[#141413]">{revokeTarget.email}</span> (
              <span className="font-medium text-[#141413]">{revokeTarget.role}</span>)?
            </p>

            <Alert variant="warning" title="Warning: Immediate Invalidation">
              This action cannot be undone. The unique invitation link will become unusable immediately, preventing the recipient from registering.
            </Alert>
          </div>
        </Modal>
      )}

      {/* Bulk Invitations Modal */}
      <BulkInviteModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={() => {
          fetchInvitations(1, pagination.limit, debouncedSearch, statusFilter, roleFilter, true);
        }}
      />
    </div>
  );
};
