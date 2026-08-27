import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Toast: React.FC = () => {
  const { notification, setNotification } = useAuth();

  if (!notification) return null;

  const isSuccess = notification.type === "success";
  const isError = notification.type === "error";

  return (
    <div className="fixed top-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-300">
      <div
        className={`p-4 rounded-2xl border shadow-xl backdrop-blur-xl flex items-start gap-3 transition-all ${
          isSuccess
            ? "bg-white/95 border-emerald-200 text-emerald-900 shadow-stone-200/60"
            : isError
            ? "bg-white/95 border-rose-200 text-rose-900 shadow-stone-200/60"
            : "bg-white/95 border-amber-200 text-amber-900 shadow-stone-200/60"
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {isError && <AlertCircle className="w-5 h-5 text-rose-600" />}
          {!isSuccess && !isError && <Info className="w-5 h-5 text-amber-600" />}
        </div>

        <div className="flex-1 text-xs font-semibold leading-relaxed">
          {notification.message}
        </div>

        <button
          onClick={() => setNotification(null)}
          className="shrink-0 p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

