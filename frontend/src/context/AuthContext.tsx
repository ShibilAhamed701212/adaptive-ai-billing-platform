import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization } from '@billing/shared';
import { apiRequest } from '../api/client';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, organization: Organization) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateOrganization: (org: Organization) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('billing_auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('billing_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [organization, setOrganization] = useState<Organization | null>(() => {
    const cached = localStorage.getItem('billing_org');
    return cached ? JSON.parse(cached) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const login = (newToken: string, newUser: User, newOrg: Organization) => {
    setToken(newToken);
    setUser(newUser);
    setOrganization(newOrg);
    localStorage.setItem('billing_auth_token', newToken);
    localStorage.setItem('billing_user', JSON.stringify(newUser));
    localStorage.setItem('billing_org', JSON.stringify(newOrg));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOrganization(null);
    localStorage.removeItem('billing_auth_token');
    localStorage.removeItem('billing_user');
    localStorage.removeItem('billing_org');
    window.location.href = '/login';
  };

  const updateOrganization = (org: Organization) => {
    setOrganization(org);
    localStorage.setItem('billing_org', JSON.stringify(org));
  };

  const refreshProfile = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiRequest('/auth/me');
      if (res.success && res.data) {
        setUser(res.data.user);
        setOrganization(res.data.organization);
        localStorage.setItem('billing_user', JSON.stringify(res.data.user));
        localStorage.setItem('billing_org', JSON.stringify(res.data.organization));
      } else {
        logout();
      }
    } catch (e) {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token,
        isLoading,
        login,
        logout,
        refreshProfile,
        updateOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
