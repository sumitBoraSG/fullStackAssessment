import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  Search,
  Check,
  Stethoscope,
  ShieldCheck,
  User,
} from "lucide-react";
import { bulkInviteUsersApi } from "../../api/adminApi";
import type {
  BulkInviteData,
  BulkInviteResultItem,
  UserRole,
} from "../../types/auth";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

interface BulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkInviteModal: React.FC<BulkInviteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Result state
  const [resultData, setResultData] = useState<BulkInviteData | null>(null);
  const [resultFilter, setResultFilter] = useState<"ALL" | "INVITED" | "FAILED">("ALL");
  const [resultSearch, setResultSearch] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal state
  const handleReset = useCallback(() => {
    setFile(null);
    setIsDragging(false);
    setIsUploading(false);
    setUploadError(null);
    setResultData(null);
    setResultFilter("ALL");
    setResultSearch("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    const shouldTriggerSuccess = !!resultData && resultData.successful > 0;
    handleReset();
    onClose();
    if (shouldTriggerSuccess && onSuccess) {
      onSuccess();
    }
  }, [resultData, handleReset, onClose, onSuccess]);

  // Escape-to-close, matching the shared Modal primitive used elsewhere in
  // the app - locked while a request is in flight, same as `disableClose`.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUploading, handleClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isUploading && e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Drag & Drop Handlers
  const handleFileSelection = (selectedFile: File) => {
    setUploadError(null);
    if (!selectedFile.name.endsWith(".csv") && selectedFile.type !== "text/csv") {
      setUploadError("Please select a valid .csv file.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit. Please upload a smaller file.");
      return;
    }

    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Download Sample CSV template
  const handleDownloadSample = () => {
    const csvContent =
      "email,role\r\n" +
      "user1@example.com,DOCTOR\r\n" +
      "user2@example.com,ADMIN\r\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bulk_invitations_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || isUploading) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await bulkInviteUsersApi(file);

      if (response.success && response.data) {
        setResultData(response.data);
      } else {
        setUploadError(
          response.error?.message ||
            response.message ||
            "Failed to process CSV file. Please verify format and try again."
        );
      }
    } catch (err: any) {
      setUploadError(err.message || "An unexpected error occurred during bulk upload.");
    } finally {
      setIsUploading(false);
    }
  };

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Badge renderers
  const renderRoleBadge = (role: UserRole | string) => {
    const normalizedRole = typeof role === "string" ? role.toUpperCase() : role;
    switch (normalizedRole) {
      case "DOCTOR":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            <Stethoscope className="w-3 h-3 text-[#141413]/70" />
            Doctor
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            <ShieldCheck className="w-3 h-3 text-[#141413]/70" />
            Admin
          </span>
        );
      case "PATIENT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            <User className="w-3 h-3 text-[#141413]/70" />
            Patient
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF]">
            {role || "Unknown"}
          </span>
        );
    }
  };

  // Filtered results
  const getFilteredResults = (): BulkInviteResultItem[] => {
    if (!resultData) return [];
    return resultData.results.filter((item: BulkInviteResultItem) => {
      const matchesFilter =
        resultFilter === "ALL" || item.status === resultFilter;
      const matchesSearch =
        resultSearch === "" ||
        item.email.toLowerCase().includes(resultSearch.toLowerCase().trim()) ||
        String(item.role).toLowerCase().includes(resultSearch.toLowerCase().trim()) ||
        (item.reason && item.reason.toLowerCase().includes(resultSearch.toLowerCase().trim()));

      return matchesFilter && matchesSearch;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleBackdropClick}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/40 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-invite-title"
        className="w-full max-w-2xl bg-[#F0EEE6] rounded-2xl border border-[#D8D0BF] shadow-xl overflow-hidden my-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] text-[#141413]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#D8D0BF] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#E3DBCC] text-[#141413] border border-[#D8D0BF] flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 id="bulk-invite-title" className="text-base font-semibold text-[#141413] m-0">
                Bulk Invitations
              </h3>
              <p className="text-xs text-[#141413]/60 m-0">
                Upload a CSV spreadsheet to send invitations in batch
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-[#141413]/50 hover:text-[#141413] hover:bg-[#E3DBCC] transition-colors cursor-pointer disabled:opacity-40"
            title="Close modal"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* VIEW 1: Upload Form (when no results yet) */}
          {!resultData && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* CSV Format Specification Box */}
              <div className="rounded-xl bg-[#E3DBCC] border border-[#D8D0BF] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#141413] uppercase tracking-wider">
                      Expected CSV Format
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF8F5] text-[#141413] font-medium border border-[#D8D0BF]">
                      Required Columns
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSample}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#141413] bg-[#FAF8F5] hover:bg-[#E3DBCC] border border-[#D8D0BF] rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="Download template file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample CSV</span>
                  </button>
                </div>

                {/* CSV Code block preview */}
                <div className="font-mono text-xs bg-[#FAF8F5] rounded-lg border border-[#D8D0BF] p-2.5 text-[#141413] leading-relaxed overflow-x-auto shadow-2xs">
                  <div className="text-[#141413]/50 font-semibold select-none border-b border-[#D8D0BF] pb-1 mb-1">
                    email,role
                  </div>
                  <div>user1@example.com,DOCTOR</div>
                  <div>user2@example.com,ADMIN</div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-[#141413]/60">
                  <span className="font-medium text-[#141413]">Supported Roles:</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF] font-mono text-[10px]">
                    DOCTOR
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF] font-mono text-[10px]">
                    ADMIN
                  </span>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelection(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  id="bulk-csv-upload-input"
                  aria-label="Upload CSV file"
                />

                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Click to browse or drag and drop your CSV file. Only .csv files up to 5MB are supported."
                    className={`border border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141413]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EEE6] ${
                      isDragging
                        ? "border-[#141413] bg-[#E3DBCC]"
                        : "border-[#D8D0BF] hover:border-[#141413] bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] text-[#141413] flex items-center justify-center shadow-xs">
                      <UploadCloud className="w-5 h-5 text-[#141413]" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#141413] m-0">
                        Click to browse or drag and drop your CSV file
                      </p>
                      <p className="text-[11px] text-[#141413]/60 mt-1 m-0">
                        Only <span className="font-semibold text-[#141413]">.csv</span> files up to 5MB are supported
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#E3DBCC] border border-[#D8D0BF] flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF] flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#141413] truncate m-0">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-[#141413]/60 mt-0.5 m-0 font-normal">
                          {formatFileSize(file.size)} &bull; Ready for upload
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isUploading}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#141413] bg-[#FAF8F5] hover:bg-[#E3DBCC] border border-[#D8D0BF] transition-all cursor-pointer shadow-2xs"
                    >
                      Change File
                    </button>
                  </div>
                )}
              </div>

              {/* Error state message */}
              {uploadError && (
                <Alert variant="error" title="Upload Failed">
                  {uploadError}
                </Alert>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D8D0BF]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isUploading}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUploading}
                  loadingText="Sending Bulk Invitations..."
                  disabled={!file || isUploading}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Invite</span>
                </Button>
              </div>
            </form>
          )}

          {/* VIEW 2: Results Display (after upload) */}
          {resultData && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Top Result Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between shadow-2xs ${
                  resultData.failed === 0
                    ? "bg-[#DCE7DD] border-[#BED4C1] text-[#1E3E26]"
                    : resultData.successful === 0
                    ? "bg-[#EEDCDA] border-[#DEC0BD] text-[#541C18]"
                    : "bg-[#EAE0CE] border-[#D4C4A8] text-[#4A3B18]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {resultData.failed === 0 ? (
                    <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] text-[#1E3E26] border border-[#BED4C1] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] text-[#4A3B18] border border-[#D4C4A8] flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-semibold m-0">
                      {resultData.failed === 0
                        ? "All Invitations Processed Successfully"
                        : resultData.successful === 0
                        ? "All Invitations Failed"
                        : "Bulk Invitation Process Completed with Partial Failures"}
                    </h4>
                    <p className="text-[11px] mt-0.5 opacity-80 m-0">
                      {resultData.successful} successful of {resultData.total} total records processed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-[#E3DBCC] border border-[#D8D0BF] shadow-2xs">
                  <span className="text-[10px] font-semibold text-[#141413]/60 uppercase tracking-wider block">
                    Total Records
                  </span>
                  <span className="text-lg font-semibold text-[#141413] mt-0.5 block">
                    {resultData.total}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#DCE7DD] border border-[#BED4C1] shadow-2xs">
                  <span className="text-[10px] font-semibold text-[#1E3E26] uppercase tracking-wider block">
                    Successful
                  </span>
                  <span className="text-lg font-semibold text-[#1E3E26] mt-0.5 block">
                    {resultData.successful}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#EEDCDA] border border-[#DEC0BD] shadow-2xs">
                  <span className="text-[10px] font-semibold text-[#541C18] uppercase tracking-wider block">
                    Failed
                  </span>
                  <span className="text-lg font-semibold text-[#541C18] mt-0.5 block">
                    {resultData.failed}
                  </span>
                </div>
              </div>

              {/* Per-row Results List / Table */}
              <div className="border border-[#D8D0BF] rounded-xl overflow-hidden shadow-2xs bg-[#FAF8F5]">
                {/* Results Controls Bar */}
                <div className="p-2.5 bg-[#E3DBCC] border-b border-[#D8D0BF] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 bg-[#FAF8F5] p-0.5 rounded-lg border border-[#D8D0BF]">
                    <button
                      type="button"
                      onClick={() => setResultFilter("ALL")}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        resultFilter === "ALL"
                          ? "bg-[#141413] text-[#F0EEE6] shadow-2xs"
                          : "text-[#141413]/70 hover:text-[#141413]"
                      }`}
                    >
                      All ({resultData.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultFilter("INVITED")}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        resultFilter === "INVITED"
                          ? "bg-[#2B5438] text-[#F0EEE6] shadow-2xs"
                          : "text-[#141413]/70 hover:text-[#141413]"
                      }`}
                    >
                      Successful ({resultData.successful})
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultFilter("FAILED")}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        resultFilter === "FAILED"
                          ? "bg-[#8E2A22] text-[#F0EEE6] shadow-2xs"
                          : "text-[#141413]/70 hover:text-[#141413]"
                      }`}
                    >
                      Failed ({resultData.failed})
                    </button>
                  </div>

                  {/* Search within results */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#141413]/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={resultSearch}
                      onChange={(e) => setResultSearch(e.target.value)}
                      placeholder="Search email or reason..."
                      className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] placeholder-[#141413]/40 focus:outline-none focus:border-[#141413] w-full sm:w-44"
                    />
                  </div>
                </div>

                {/* Per-Row Table */}
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[#141413]">
                    <thead>
                      <tr className="border-b border-[#D8D0BF] bg-[#E3DBCC]/60 text-[10px] font-semibold text-[#141413]/70 uppercase tracking-wider sticky top-0">
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-2.5">Role</th>
                        <th className="py-2 px-2.5">Status</th>
                        <th className="py-2 px-3">Details / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8D0BF]/60 text-xs">
                      {getFilteredResults().map((item, idx) => {
                        const isInvited = item.status === "INVITED";
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-[#E3DBCC]/40 transition-colors ${
                              !isInvited ? "bg-[#EEDCDA]/30" : ""
                            }`}
                          >
                            <td className="py-2 px-3 font-medium text-[#141413] max-w-[180px] truncate">
                              {item.email || "(blank)"}
                            </td>
                            <td className="py-2 px-2.5">
                              {renderRoleBadge(item.role)}
                            </td>
                            <td className="py-2 px-2.5">
                              {isInvited ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#DCE7DD] text-[#1E3E26] border border-[#BED4C1]">
                                  <Check className="w-3 h-3" />
                                  Invited
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#EEDCDA] text-[#541C18] border border-[#DEC0BD]">
                                  <X className="w-3 h-3" />
                                  Failed
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[#141413]/60 text-[11px]">
                              {isInvited ? (
                                <span className="text-[#1E3E26] font-medium">
                                  Invitation email dispatched
                                </span>
                              ) : (
                                <span className="text-[#541C18] font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  {item.reason || "Failed to process invitation"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {getFilteredResults().length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center text-xs text-[#141413]/50"
                          >
                            No results found matching your current filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#D8D0BF]">
                <Button type="button" variant="secondary" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Upload Another CSV</span>
                </Button>

                <Button type="button" variant="primary" onClick={handleClose}>
                  <span>Done</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
