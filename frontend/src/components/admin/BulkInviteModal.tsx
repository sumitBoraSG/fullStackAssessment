import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Check,
  RotateCcw,
  Search,
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
  onSuccess: () => void;
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
  const [resultData, setResultData] = useState<BulkInviteData | null>(null);
  const [resultFilter, setResultFilter] = useState<"ALL" | "INVITED" | "FAILED">("ALL");
  const [resultSearch, setResultSearch] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when closing or resetting
  const handleReset = () => {
    setFile(null);
    setUploadError(null);
    setResultData(null);
    setResultFilter("ALL");
    setResultSearch("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    const hasSuccessful = resultData && resultData.successful > 0;
    handleReset();
    if (hasSuccessful) {
      onSuccess();
    }
    onClose();
  };

  // Validate and handle selected file
  const handleFileSelection = (selectedFile?: File | null) => {
    setUploadError(null);
    if (!selectedFile) return;

    if (
      !selectedFile.name.toLowerCase().endsWith(".csv") &&
      selectedFile.type !== "text/csv" &&
      selectedFile.type !== "application/vnd.ms-excel"
    ) {
      setUploadError("Please select a valid .csv file.");
      setFile(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit. Please upload a smaller file.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  // Drag and Drop handlers
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
      "user2@example.com,PATIENT\r\n" +
      "user3@example.com,ADMIN\r\n";

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <Stethoscope className="w-3 h-3 text-teal-600" />
            Doctor
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            <ShieldCheck className="w-3 h-3 text-amber-600" />
            Admin
          </span>
        );
      case "PATIENT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">
            <User className="w-3 h-3 text-orange-600" />
            Patient
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
            {role || "Unknown"}
          </span>
        );
    }
  };

  // Filtered results
  const getFilteredResults = (): BulkInviteResultItem[] => {
    if (!resultData) return [];
    return resultData.results.filter((item) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/35 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden my-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 m-0">
                Bulk Invitations
              </h3>
              <p className="text-xs text-stone-500 m-0">
                Upload a CSV spreadsheet to send invitations in batch
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-40"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* VIEW 1: Upload Form (when no results yet) */}
          {!resultData && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* CSV Format Specification Box */}
              <div className="rounded-2xl bg-stone-50 border border-stone-200/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      Expected CSV Format
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                      Required Columns
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSample}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                    title="Download template file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample CSV</span>
                  </button>
                </div>

                {/* CSV Code block preview */}
                <div className="font-mono text-xs bg-white rounded-xl border border-stone-200 p-3 text-stone-700 leading-relaxed overflow-x-auto shadow-2xs">
                  <div className="text-stone-400 font-bold select-none border-b border-stone-100 pb-1 mb-1">
                    email,role
                  </div>
                  <div>user1@example.com,DOCTOR</div>
                  <div>user2@example.com,PATIENT</div>
                  <div>user3@example.com,ADMIN</div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-500">
                  <span className="font-semibold text-stone-700">Supported Roles:</span>
                  <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-medium font-mono text-[10px]">
                    DOCTOR
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 font-medium font-mono text-[10px]">
                    PATIENT
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-medium font-mono text-[10px]">
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
                />

                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                      isDragging
                        ? "border-amber-500 bg-amber-50/60 scale-[0.99]"
                        : "border-stone-300 hover:border-amber-400 bg-stone-50/40 hover:bg-stone-50"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 text-stone-500 flex items-center justify-center shadow-xs">
                      <UploadCloud className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-800 m-0">
                        Click to browse or drag and drop your CSV file
                      </p>
                      <p className="text-xs text-stone-500 mt-1 m-0">
                        Only <span className="font-semibold text-stone-700">.csv</span> files up to 5MB are supported
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-900 truncate m-0">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5 m-0 font-medium">
                          {formatFileSize(file.size)} &bull; Ready for upload
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isUploading}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-white border border-transparent hover:border-stone-200 transition-all cursor-pointer"
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
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
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
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Top Result Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between shadow-2xs ${
                  resultData.failed === 0
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    : resultData.successful === 0
                    ? "bg-rose-50/80 border-rose-200 text-rose-900"
                    : "bg-amber-50/80 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  {resultData.failed === 0 ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold m-0">
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
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Total Records
                  </span>
                  <span className="text-xl font-extrabold text-stone-900 mt-1 block">
                    {resultData.total}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Successful
                  </span>
                  <span className="text-xl font-extrabold text-emerald-900 mt-1 block">
                    {resultData.successful}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                    Failed
                  </span>
                  <span className="text-xl font-extrabold text-rose-900 mt-1 block">
                    {resultData.failed}
                  </span>
                </div>
              </div>

              {/* Per-row Results List / Table */}
              <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
                {/* Results Controls Bar */}
                <div className="p-3 bg-stone-50/80 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setResultFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        resultFilter === "ALL"
                          ? "bg-stone-900 text-white shadow-2xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      All ({resultData.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultFilter("INVITED")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        resultFilter === "INVITED"
                          ? "bg-emerald-700 text-white shadow-2xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      Successful ({resultData.successful})
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultFilter("FAILED")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        resultFilter === "FAILED"
                          ? "bg-rose-700 text-white shadow-2xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      Failed ({resultData.failed})
                    </button>
                  </div>

                  {/* Search within results */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={resultSearch}
                      onChange={(e) => setResultSearch(e.target.value)}
                      placeholder="Search email or reason..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-stone-200 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs w-full sm:w-48"
                    />
                  </div>
                </div>

                {/* Per-Row Table */}
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-[10px] font-bold text-stone-500 uppercase tracking-wider sticky top-0">
                        <th className="py-2.5 px-3.5">Email</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3.5">Details / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                      {getFilteredResults().map((item, idx) => {
                        const isInvited = item.status === "INVITED";
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-stone-50/80 transition-colors ${
                              !isInvited ? "bg-rose-50/20" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3.5 font-medium text-stone-900 max-w-[180px] truncate">
                              {item.email || "(blank)"}
                            </td>
                            <td className="py-2.5 px-3">
                              {renderRoleBadge(item.role)}
                            </td>
                            <td className="py-2.5 px-3">
                              {isInvited ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  Invited
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <X className="w-3 h-3" />
                                  Failed
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-stone-500 text-[11px]">
                              {isInvited ? (
                                <span className="text-emerald-700 font-medium">
                                  Invitation email dispatched
                                </span>
                              ) : (
                                <span className="text-rose-700 font-medium flex items-center gap-1">
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
                            className="py-8 text-center text-xs text-stone-400"
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
              <div className="flex items-center justify-between pt-3 border-t border-stone-100">
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
