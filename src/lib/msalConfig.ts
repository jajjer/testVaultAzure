import type { Configuration } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID ?? "";
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID ?? "";
const apiScope = import.meta.env.VITE_AZURE_AD_API_SCOPE ?? "";

export const apiScopes = apiScope ? [apiScope] : [`api://${clientId}/access_as_user`];

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI ?? window.location.origin,
    postLogoutRedirectUri:
      import.meta.env.VITE_MSAL_POST_LOGOUT_REDIRECT_URI ?? window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export function isMsalConfigured(): boolean {
  return Boolean(clientId && tenantId);
}
