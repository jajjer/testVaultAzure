import { useEffect } from "react";

import { useTestRunStore } from "@/store/test-run-store";

export function useTestRunsSync(projectId: string | undefined) {
  useEffect(() => {
    if (!projectId) {
      useTestRunStore.getState().stop();
      return;
    }
    return useTestRunStore.getState().listen(projectId);
  }, [projectId]);
}
