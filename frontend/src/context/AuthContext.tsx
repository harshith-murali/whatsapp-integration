import React, { createContext, useContext, useState, useEffect } from "react";
import { api, registerUnauthorizedHandler } from "../api/index.js";

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER";

export interface Admin {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
}

interface AuthContextType {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Admin>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const response = await api.get("/auth/me");
      if (response.data?.success) {
        setAdmin(response.data.data);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();

    // Register global 401 handler
    registerUnauthorizedHandler(() => {
      setAdmin(null);
    });
  }, []);

  const login = async (email: string, password: string): Promise<Admin> => {
    const response = await api.post("/auth/login", { email, password });
    const user = response.data.data;
    setAdmin(user);
    return user;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
