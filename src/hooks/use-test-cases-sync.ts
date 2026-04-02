import { useEffect } from "react";

import { useTestCaseStore } from "@/store/test-case-store";

export function useTestCasesSync(projectId: string | undefined) {
  useEffect(() => {
    if (!projectId) {
      useTestCaseStore.getState().stop();
      return;
    }
    return useTestCaseStore.getState().listen(projectId);
  }, [projectId]);
}
