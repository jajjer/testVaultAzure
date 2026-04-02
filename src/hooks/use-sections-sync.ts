import { useEffect } from "react";

import { ensureDefaultSuite } from "@/lib/ensure-default-suite";
import { useSectionStore } from "@/store/section-store";

export function useSectionsSync(projectId: string | undefined) {
  useEffect(() => {
    if (!projectId) {
      useSectionStore.getState().stop();
      return;
    }

    let cancelled = false;

    void ensureDefaultSuite(projectId)
      .then(() => {
        if (cancelled) return;
        useSectionStore.getState().listen(projectId);
      })
      .catch((e) => {
        console.error("[Railyard] ensureDefaultSuite:", e);
      });

    return () => {
      cancelled = true;
      useSectionStore.getState().stop();
    };
  }, [projectId]);
}
