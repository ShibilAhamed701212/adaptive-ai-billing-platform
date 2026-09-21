import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Organization, Membership } from '@billing/shared';
import { apiRequest } from '../api/client';

interface CreateOrganizationPayload {
  name: string;
  businessType: string;
  billingModel?: string;
  enabledModules?: string[];
  settings?: Record<string, any>;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  memberships: Membership[];
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, organization: Organization, memberships?: Membership[]) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateOrganization: (org: Organization) => void;
  switchOrganization: (organizationId: string) => Promise<{ success: boolean; error?: string }>;
  createOrganization: (payload: CreateOrganizationPayload) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'billing_auth_token';
const USER_KEY = 'billing_user';
const ORG_KEY = 'billing_org';
const MEMBERSHIPS_KEY = 'billing_memberships';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const cached = localStorage.getItem(key);
    return cached ? (JSON.parse(cached) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const persist = useCallback((nextToken: string | null, nextUser: User | null, nextOrg: Organization | null, nextMemberships: Membership[]) => {
    // Sessions live in an HTTP-only cookie. Keep this argument-compatible helper
    // so callers update React state without putting credentials in web storage.
    void nextToken; void nextUser; void nextOrg; void nextMemberships;
  }, []);

  const login = (newToken: string, newUser: User, newOrg: Organization, newMemberships: Membership[] = []) => {
    setToken(newToken);
    setUser(newUser);
    setOrganization(newOrg);
    setMemberships(newMemberships);
    persist(newToken, newUser, newOrg, newMemberships);
  };

  const logout = () => {
    void apiRequest('/auth/logout', { method: 'POST' });
    setToken(null);
    setUser(null);
    setOrganization(null);
    setMemberships([]);
    localStorage.removeItem(TOKEN_KEY); // remove legacy sessions created by older builds
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ORG_KEY);
    localStorage.removeItem(MEMBERSHIPS_KEY);
    window.location.href = '/login';
  };

  const updateOrganization = (org: Organization) => {
    setOrganization(org);
    persist(token, user, org, memberships);
  };

  const refreshProfile = async () => {
    try {
      const res = await apiRequest<{ token?: string; user: User; organization: Organization; memberships: Membership[] }>('/auth/me');
      if (res.success && res.data) {
        const nextToken = res.data.token || null;
        setToken(nextToken);
        setUser(res.data.user);
        setOrganization(res.data.organization);
        setMemberships(res.data.memberships || []);
        persist(nextToken, res.data.user, res.data.organization, res.data.memberships || []);
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const applySession = (res: any): boolean => {
    if (res.success && res.data) {
      const nextToken = res.data.token || '';
      const nextUser = res.data.user;
      const nextOrg = res.data.organization;
      const nextMemberships = res.data.memberships || [];
      setToken(nextToken);
      setUser(nextUser);
      setOrganization(nextOrg);
      setMemberships(nextMemberships);
      persist(nextToken, nextUser, nextOrg, nextMemberships);
      return true;
    }
    return false;
  };

  const switchOrganization = async (organizationId: string) => {
    const res = await apiRequest('/organizations/switch', {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    });
    if (applySession(res)) return { success: true };
    return { success: false, error: res.error?.message || 'Unable to switch organization' };
  };

  const createOrganization = async (payload: CreateOrganizationPayload) => {
    const res = await apiRequest('/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (applySession(res)) return { success: true };
    return { success: false, error: res.error?.message || 'Unable to create organization' };
  };

  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        memberships,
        token,
        isLoading,
        login,
        logout,
        refreshProfile,
        updateOrganization,
        switchOrganization,
        createOrganization,
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
