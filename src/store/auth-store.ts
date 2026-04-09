import { create } from "zustand";

import { apiJson } from "@/lib/api";
import { apiScopes, isMsalConfigured } from "@/lib/msalConfig";
import { getMsalInstance } from "@/lib/msalInstance";
import type { UserProfile, UserRole } from "@/types/models";

export function canManageContent(role: UserRole): boolean {
  return role === "admin" || role === "test_lead";
}

export interface AuthAccount {
  /** Entra object id (or dev uid). */
  localAccountId: string;
  name?: string;
  username?: string;
}

interface AuthState {
  account: AuthAccount | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  error: string | null;
  init: () => () => void;
  signIn: () => Promise<void>;
  signUp: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

async function fetchProfileMe(): Promise<UserProfile> {
  return apiJson<UserProfile>("/api/me");
}

export const useAuthStore = create<AuthState>((set, get) => ({
  account: null,
  profile: null,
  authLoading: true,
  profileLoading: false,
  error: null,

  refreshProfile: async () => {
    try {
      const profile = await fetchProfileMe();
      set({ profile, profileLoading: false });
    } catch {
      set({ profile: null, profileLoading: false });
    }
  },

  init: () => {
    const skip = import.meta.env.VITE_SKIP_AUTH === "true";
    if (skip) {
      set({
        account: {
          localAccountId: "dev-user",
          name: "Dev User",
          username: "dev@localhost",
        },
        authLoading: false,
        profileLoading: true,
      });
      void get()
        .refreshProfile()
        .then(() => {})
        .catch(() => set({ profileLoading: false }));
      return () => {};
    }

    if (!isMsalConfigured()) {
      set({
        account: null,
        profile: null,
        authLoading: false,
        profileLoading: false,
        error: "Missing Azure AD app configuration (see .env.example).",
      });
      return () => {};
    }

    const pca = getMsalInstance();
    void pca.initialize().then(() => {
      void pca.handleRedirectPromise().then(() => {
        const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
        if (account) {
          pca.setActiveAccount(account);
          set({
            account: {
              localAccountId: account.localAccountId,
              name: account.name,
              username: account.username,
            },
            authLoading: false,
            profileLoading: true,
          });
          void get()
            .refreshProfile()
            .catch(() => set({ profileLoading: false }));
        } else {
          set({
            account: null,
            profile: null,
            authLoading: false,
            profileLoading: false,
          });
        }
      });
    });

    return () => {};
  },

  signIn: async () => {
    set({ error: null });
    if (import.meta.env.VITE_SKIP_AUTH === "true") {
      await get().refreshProfile();
      return;
    }
    const pca = getMsalInstance();
    await pca.loginRedirect({ scopes: apiScopes });
  },

  signUp: async () => {
    set({
      error:
        "Registration is managed by your organization. Sign in with Microsoft.",
    });
  },

  logout: async () => {
    if (import.meta.env.VITE_SKIP_AUTH === "true") {
      set({ account: null, profile: null });
      return;
    }
    const pca = getMsalInstance();
    await pca.logoutRedirect();
  },

  clearError: () => set({ error: null }),
}));
