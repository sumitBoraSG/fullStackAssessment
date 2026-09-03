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
  amber: "bg-[#EAE0CE] border-[#D4C4A8] text-[#7A5B18]",
  rose: "bg-[#EEDCDA] border-[#DEC0BD] text-[#7A2420]",
  teal: "bg-[#D7E3DC] border-[#BACEC3] text-[#285741]",
  emerald: "bg-[#DCE7DD] border-[#BED4C1] text-[#265330]",
  blue: "bg-[#D8DFE6] border-[#BAC6D3] text-[#274560]",
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "bg-[#F0EEE6] rounded-xl border border-[#D8D0BF] shadow-lg w-full flex flex-col text-[#141413] animate-in zoom-in-95 duration-150",
          sizeClasses[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-7 pb-4 flex items-start gap-3.5">
          {Icon && (
            <div
              className={cn(
                "w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 shadow-xs",
                iconColorClasses[iconColor],
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-[#141413] tracking-tight m-0">{title}</h2>
            {description && <p className="text-xs text-[#141413]/60 mt-1 leading-relaxed">{description}</p>}
          </div>
        </div>

        <div className="px-6 sm:px-7 pb-6 sm:pb-7 max-h-[80vh] overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 sm:px-7 py-3.5 border-t border-[#D8D0BF] bg-[#E3DBCC]/30 rounded-b-xl flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
