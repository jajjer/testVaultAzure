/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AZURE_AD_CLIENT_ID: string;
  readonly VITE_AZURE_AD_TENANT_ID: string;
  /** e.g. api://{api-app-id}/access_as_user */
  readonly VITE_AZURE_AD_API_SCOPE: string;
  readonly VITE_MSAL_REDIRECT_URI: string;
  readonly VITE_MSAL_POST_LOGOUT_REDIRECT_URI: string;
  /** When "true", sends X-TestVault-Dev-User to API (requires API SKIP_AUTH=1). */
  readonly VITE_SKIP_AUTH: string;
  readonly VITE_DEV_USER_JSON: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
