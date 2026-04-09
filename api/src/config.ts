import "dotenv/config";

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || String(v).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const isProduction = process.env.NODE_ENV === "production";

/** When true, trust X-TestVault-Dev-User JSON header (local dev only). */
export const skipAuth =
  process.env.SKIP_AUTH === "1" || process.env.SKIP_AUTH === "true";

export const sqlConnectionString = process.env.AZURE_SQL_CONNECTION_STRING ?? "";

export const azureAd = {
  tenantId: process.env.AZURE_AD_TENANT_ID ?? "",
  audience: process.env.AZURE_AD_AUDIENCE ?? "",
};

export const storageConnectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING ?? "";

export const apiPort = Number(process.env.PORT ?? "3001");

export function validateConfigForStart(): void {
  if (!sqlConnectionString) {
    throw new Error("AZURE_SQL_CONNECTION_STRING is required");
  }
  if (!skipAuth) {
    req("AZURE_AD_TENANT_ID");
    req("AZURE_AD_AUDIENCE");
  }
}
