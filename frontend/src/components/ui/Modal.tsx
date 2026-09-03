import React, { useEffect } from "react";
import { cn } from "../../utils/cn";

export type ModalIconColor = "amber" | "rose" | "teal" | "emerald" | "blue";
export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: ModalIconColor;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  disableClose?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

const iconColorClasses: Record<ModalIconColor, string> = {
  amber: "bg-amber-50 border-amber-200/80 text-amber-600",
  rose: "bg-rose-50 border-rose-200/80 text-rose-600",
  teal: "bg-teal-50 border-teal-200/80 text-teal-600",
  emerald: "bg-emerald-50 border-emerald-200/80 text-emerald-600",
  blue: "bg-blue-50 border-blue-200/80 text-blue-600",
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  iconColor = "amber",
  size = "md",
  closeOnBackdrop,
  closeOnEscape,
  disableClose,
  footer,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape !== false && !disableClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, disableClose, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop !== false && !disableClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "bg-white rounded-3xl border border-stone-200 shadow-2xl w-full flex flex-col",
          sizeClasses[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8 pb-4 flex items-start gap-4">
          {Icon && (
            <div
              className={cn(
                "w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs",
                iconColorClasses[iconColor],
              )}
            >
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-stone-900 tracking-tight m-0">{title}</h2>
            {description && <p className="text-xs text-stone-500 mt-1 leading-relaxed">{description}</p>}
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 sm:pb-8 max-h-[80vh] overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 sm:px-8 py-4 border-t border-stone-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
