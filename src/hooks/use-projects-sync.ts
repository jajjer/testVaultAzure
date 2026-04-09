import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

/** Keeps `useProjectStore` in sync with Firestore for the signed-in user. Admins receive all projects; others only projects they belong to. */
export function useProjectsSync() {
  const uid = useAuthStore((s) => s.account?.localAccountId);
  const profile = useAuthStore((s) => s.profile);
  const profileLoading = useAuthStore((s) => s.profileLoading);

  useEffect(() => {
    if (!uid) {
      useProjectStore.getState().stop();
      return;
    }
    if (profileLoading || !profile) {
      useProjectStore.getState().stop();
      return;
    }
    return useProjectStore.getState().listen(uid, profile.role);
  }, [uid, profileLoading, profile]);
}
