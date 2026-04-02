import { doc, getDoc, setDoc } from "firebase/firestore";

import { getFirestoreDb } from "@/lib/firebase";
import { DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";

/** Ensures `projects/{projectId}/suites/default` exists for section (folder) documents. */
export async function ensureDefaultSuite(projectId: string): Promise<void> {
  const db = getFirestoreDb();
  const suiteRef = doc(db, "projects", projectId, "suites", DEFAULT_SUITE_ID);
  const snap = await getDoc(suiteRef);
  if (snap.exists()) return;
  const now = Date.now();
  await setDoc(suiteRef, {
    projectId,
    name: "Default",
    description: "",
    order: 0,
    createdAt: now,
    updatedAt: now,
  });
}
