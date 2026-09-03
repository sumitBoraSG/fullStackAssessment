import React, { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Toast: React.FC = () => {
  const { notification, setNotification } = useAuth();

  useEffect(() => {
    if (!notification) return;

    const { type, message } = notification;
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast.info(message);

    setNotification(null);
  }, [notification, setNotification]);

  return (
    <Toaster
      position="top-right"
      theme="light"
      richColors={false}
      closeButton
      gap={8}
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-[#2B5438]" />,
        error: <AlertCircle className="w-4 h-4 text-[#8E2A22]" />,
        info: <Info className="w-4 h-4 text-[#7A5B18]" />,
      }}
      toastOptions={{
        duration: 5000,
        unstyled: true,
        classNames: {
          toast:
            "flex items-start gap-3 w-full max-w-md rounded-xl border border-[#D8D0BF] bg-[#E3DBCC] px-3.5 py-3 text-[#141413] shadow-md",
          title: "text-xs font-medium leading-relaxed text-[#141413]",
          closeButton:
            "!bg-transparent !border-none !text-[#141413]/40 hover:!text-[#141413] hover:!bg-[#D8D0BF]/40",
        },
      }}
    />
  );
};
