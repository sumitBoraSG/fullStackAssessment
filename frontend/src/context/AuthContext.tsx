import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "../types/auth";
import { loginApi, logoutApi } from "../api/authApi";
import {
  SESSION_EXPIRED_EVENT,
  USER_KEY,
  clearAuthStorage,
} from "../api/apiClient";

interface Notification {
  type: "success" | "error" | "info";
  message: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  notification: Notification | null;
  setNotification: (notif: Notification | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setNotification(null);

    const res = await loginApi(email, password);
    setIsLoading(false);

    if (res.success && res.data) {
      const { user: receivedUser } = res.data;
      setUser(receivedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(receivedUser));

      setNotification({
        type: "success",
        message: `Welcome back, ${receivedUser.firstName || receivedUser.email}!`,
      });

      return { success: true };
    } else {
      const errMsg = res.error?.message || "Invalid credentials. Please try again.";
      setNotification({
        type: "error",
        message: errMsg,
      });
      return { success: false, message: errMsg };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    await logoutApi();

    setUser(null);
    clearAuthStorage();
    setIsLoading(false);

    setNotification({
      type: "info",
      message: "You have been logged out successfully.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        notification,
        setNotification,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
