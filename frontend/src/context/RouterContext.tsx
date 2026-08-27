import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface RouterContextType {
  path: string;
  search: string;
  getParam: (key: string) => string | null;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, setCurrentUrl] = useState<string>(() => window.location.pathname + window.location.search);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentUrl(window.location.pathname + window.location.search);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const path = window.location.pathname;
  const search = window.location.search;

  const getParam = useCallback((key: string): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(key);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState({}, "", to);
    } else {
      window.history.pushState({}, "", to);
    }
    setCurrentUrl(window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <RouterContext.Provider value={{ path, search, getParam, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
};
