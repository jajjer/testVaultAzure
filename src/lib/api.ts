import { apiScopes } from "./msalConfig";
import { getMsalInstance } from "./msalInstance";

const base = import.meta.env.VITE_API_BASE_URL ?? "";

function devUserHeader(): Record<string, string> {
  if (import.meta.env.VITE_SKIP_AUTH !== "true") return {};
  const raw = import.meta.env.VITE_DEV_USER_JSON;
  if (typeof raw === "string" && raw.trim()) {
    return { "X-TestVault-Dev-User": raw };
  }
  return {
    "X-TestVault-Dev-User": JSON.stringify({
      uid: "dev-user-1",
      email: "dev@localhost",
      displayName: "Dev User",
    }),
  };
}

export async function getAccessToken(): Promise<string | null> {
  if (import.meta.env.VITE_SKIP_AUTH === "true") return null;
  const pca = getMsalInstance();
  const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
  if (!account) return null;
  try {
    const result = await pca.acquireTokenSilent({
      account,
      scopes: apiScopes,
    });
    return result.accessToken;
  } catch {
    await pca.acquireTokenRedirect({ scopes: apiScopes, account });
    return null;
  }
}

export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = await getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  for (const [k, v] of Object.entries(devUserHeader())) {
    headers.set(k, v);
  }
  const url = path.startsWith("http") ? path : `${base}${path}`;
  return fetch(url, { ...init, headers });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}
