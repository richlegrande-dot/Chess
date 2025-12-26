/**
 * Admin Session Store
 * 
 * Manages admin authentication state
 * - Stores token in memory (not localStorage - Care2Connect lesson)
 * - Provides session management
 */

import { create } from 'zustand';

interface AdminSession {
  token: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
}

interface AdminStore extends AdminSession {
  setSession: (token: string, expiresAt: string) => void;
  clearSession: () => void;
  isSessionValid: () => boolean;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  token: null,
  expiresAt: null,
  isAuthenticated: false,

  setSession: (token: string, expiresAt: string) => {
    set({
      token,
      expiresAt,
      isAuthenticated: true,
    });
  },

  clearSession: () => {
    set({
      token: null,
      expiresAt: null,
      isAuthenticated: false,
    });
  },

  isSessionValid: () => {
    const { expiresAt } = get();
    if (!expiresAt) return false;
    return new Date(expiresAt) > new Date();
  },
}));
