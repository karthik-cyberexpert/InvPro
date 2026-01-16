import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string, passwordHash: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('inventory_user');
    if (savedUser) {
      setUser(savedUser);
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username: string, passwordHash: string): Promise<boolean> => {
    try {
      const result = await invoke<boolean>("login_user", { username, passwordHash });
      if (result) {
        setIsAuthenticated(true);
        setUser(username);
        localStorage.setItem('inventory_user', username);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('inventory_user');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
