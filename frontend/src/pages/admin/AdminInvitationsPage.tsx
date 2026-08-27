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
  AlertTriangle,
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
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Quick copy email helper
  const handleCopyEmail = (email: string, id: string | number) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Date formatting helper
  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "—";
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const getRelativeExpiry = (expiresAtIso: string, status: InvitationStatus): string => {
    if (status !== "PENDING") return "";
    try {
      const now = new Date().getTime();
      const expiry = new Date(expiresAtIso).getTime();
      const diffMs = expiry - now;
      if (diffMs <= 0) return "Expired";
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (diffHours > 0) {
        return `(${diffHours}h ${diffMins}m left)`;
      }
      return `(${diffMins}m left)`;
    } catch {
      return "";
    }
  };

  // Status badge renderer
  const renderStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending
          </span>
        );
      case "USED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Accepted
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-stone-500" />
            Expired
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Role badge renderer
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case "DOCTOR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs">
            <Stethoscope className="w-3 h-3 text-teal-600" />
            Doctor
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs">
            <ShieldCheck className="w-3 h-3 text-amber-600" />
            Admin
          </span>
        );
      case "PATIENT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200/80 shadow-2xs">
            <User className="w-3 h-3 text-orange-600" />
            Patient
          </span>
        );
    }
  };

  // Single invite form handling
  const validateInvite = (): boolean => {
    const errs: { email?: string; role?: string } = {};
    const trimmed = inviteEmail.trim();
    if (!trimmed) {
      errs.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      errs.email = "Please enter a valid email address";
    }
    if (!inviteRole) {
      errs.role = "Please select a role";
    }
    setInviteErrors(errs);
    return Object.keys(errs).length === 0;
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight m-0">
            Invitations
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-xl">
            Manage, monitor, and issue registration invitations for practitioners and patients.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Refresh Action */}
          <button
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
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-50 active:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh table"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshing ? "animate-spin text-amber-600" : "text-stone-500"
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Bulk Invite Action */}
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 active:bg-amber-200/80 border border-amber-200/90 text-amber-900 text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Upload CSV for bulk invitations"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-700" />
            <span>Bulk Invite</span>
          </button>

          {/* Single Invite Action */}
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Invite User</span>
          </button>
        </div>
      </div>

      {/* Unified Search & Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by recipient email..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-stone-50/60 border border-stone-200 text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedSearch("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
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
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs cursor-pointer"
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
                className="text-xs bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="DOCTOR">Doctor</option>
                <option value="PATIENT">Patient</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {/* Rows Per Page */}
            <div className="flex items-center gap-1.5 text-xs text-stone-500 pl-1 border-l border-stone-200">
              <span className="hidden sm:inline font-medium">Rows:</span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="text-xs bg-white border border-stone-200 rounded-xl px-2 py-1.5 text-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
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
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        {/* Error State Banner */}
        {fetchError && !isLoading && (
          <div className="p-4 sm:p-5 m-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold m-0 text-rose-900">Failed to load invitations</h4>
                <p className="text-xs text-rose-700 mt-0.5 m-0">{fetchError}</p>
              </div>
            </div>
            <button
              onClick={() =>
                fetchInvitations(
                  pagination.page,
                  pagination.limit,
                  debouncedSearch,
                  statusFilter,
                  roleFilter
                )
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-16 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800 m-0">Loading invitations...</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Fetching records from server</p>
            </div>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !fetchError && invitations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Recipient Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 sm:px-6">Expiry Date</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                {invitations.map((invitation) => {
                  const isCopied = copiedId === invitation.id;
                  const relativeExpiry = getRelativeExpiry(invitation.expiresAt, invitation.status);
                  const canRevoke = invitation.status !== "USED" && invitation.status !== "REVOKED";

                  return (
                    <tr
                      key={invitation.id}
                      className="hover:bg-stone-50/70 transition-colors group"
                    >
                      {/* Email Column */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {invitation.email.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-stone-900 truncate">
                                {invitation.email}
                              </span>
                              <button
                                onClick={() => handleCopyEmail(invitation.email, invitation.id)}
                                className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Copy email address"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-stone-400 block font-mono">
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
                      <td className="py-3.5 px-4 text-stone-600">
                        <span className="block font-medium">
                          {formatDate(invitation.createdAt)}
                        </span>
                      </td>

                      {/* Expiry Date Column */}
                      <td className="py-3.5 px-4 sm:px-6 text-stone-600">
                        <div className="space-y-0.5">
                          <span className="block font-medium">
                            {formatDate(invitation.expiresAt)}
                          </span>
                          {relativeExpiry && (
                            <span className="text-[10px] font-bold text-amber-700 block">
                              {relativeExpiry}
                            </span>
                          )}
                          {invitation.usedAt && (
                            <span className="text-[10px] font-medium text-emerald-700 block">
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
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200/90 shadow-2xs transition-all cursor-pointer"
                            title="Revoke invitation"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <span className="text-xs text-stone-300 select-none px-2 py-1">—</span>
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
          <div className="p-14 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-stone-100 text-stone-400">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800 m-0">No invitations found</p>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? "No invitations match your search and filter criteria. Try resetting filters."
                  : "No invitations have been issued yet. Send your first invitation to get started."}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              {hasActiveFilters ? (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Invite New User</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && !fetchError && pagination.total > 0 && (
          <div className="p-4 sm:px-6 border-t border-stone-100 bg-stone-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600">
            <div>
              Showing <span className="font-bold text-stone-900">{startRecord}</span> to{" "}
              <span className="font-bold text-stone-900">{endRecord}</span> of{" "}
              <span className="font-bold text-stone-900">{pagination.total}</span> invitations
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 mx-1">
                {getPaginationRange().map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-stone-400 select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === pagination.page;
                  return (
                    <button
                      key={`page-${p}`}
                      onClick={() => handlePageChange(Number(p))}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "border border-stone-200 bg-white hover:bg-stone-100 text-stone-700"
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
                className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 m-0">
                    Invite New User
                  </h3>
                  <p className="text-xs text-stone-500 m-0">
                    Send single onboarding registration link
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                disabled={isSubmitting}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendInvite} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. practitioner@docpulse.com"
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 transition-all ${
                    inviteErrors.email
                      ? "border-rose-400 ring-rose-500/20"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                  }`}
                />
                {inviteErrors.email && (
                  <p className="text-xs text-rose-600 mt-1 font-medium m-0">
                    {inviteErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Assign Role <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
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
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 shadow-2xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`w-4 h-4 ${isSelected ? "text-amber-600" : "text-stone-400"}`} />
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
                        </div>
                        <span className="text-xs font-bold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-[11px] text-stone-500 flex items-start gap-2">
                <Clock className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <span>
                  The invitation link will automatically expire in 24 hours. The recipient will be invited to set their password.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Invitation...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-stone-100 flex items-center justify-between bg-rose-50/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100/80 text-rose-700 border border-rose-200 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 m-0">
                    Revoke Invitation
                  </h3>
                  <p className="text-xs text-stone-500 m-0">
                    Immediately invalidate registration access
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseRevokeModal}
                disabled={isRevoking}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {revokeError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="m-0 font-medium">{revokeError}</p>
                </div>
              )}

              <p className="text-xs text-stone-600 leading-relaxed m-0">
                Are you sure you want to revoke the registration invitation for{" "}
                <span className="font-bold text-stone-900">{revokeTarget.email}</span> (
                <span className="font-semibold text-stone-700">{revokeTarget.role}</span>)?
              </p>

              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-[11px] text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold block text-amber-950 mb-0.5">Warning: Immediate Invalidation</span>
                  This action cannot be undone. The unique invitation link will become unusable immediately, preventing the recipient from registering.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 bg-stone-50/50 border-t border-stone-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseRevokeModal}
                disabled={isRevoking}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isRevoking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Revoking...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirm Revoke</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
