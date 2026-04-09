import { PublicClientApplication } from "@azure/msal-browser";

import { isMsalConfigured, msalConfig } from "./msalConfig";

let instance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (!instance) {
    if (!isMsalConfigured()) {
      throw new Error(
        "MSAL is not configured. Set VITE_AZURE_AD_CLIENT_ID and VITE_AZURE_AD_TENANT_ID (or enable VITE_SKIP_AUTH for local API dev)."
      );
    }
    instance = new PublicClientApplication(msalConfig);
  }
  return instance;
}
