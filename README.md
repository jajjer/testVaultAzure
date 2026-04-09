# Test Vault

Self-hosted test management for QA: projects, nested folders for test cases, test runs, and pass/fail results—similar in spirit to tools like TestRail, with a **React SPA**, **Node API**, **Azure SQL**, and **Microsoft Entra ID** sign-in.

## Features

- **Auth & roles** — Microsoft Entra ID (MSAL); `admin`, `test_lead`, and `tester` roles enforced in the API and UI.
- **Projects** — Multi-project workspace with optional parameters metadata.
- **Test cases** — Titles, steps, priority/type/status, custom fields, TestRail-style case IDs (`C1`, `C2`, …).
- **Folders** — Nested sections; move cases between folders; folder-scoped selection when building test runs.
- **Test runs** — Snapshot a set of cases, edit runs, record results per case.
- **Attachments** — Azure Blob Storage via SAS URLs from the API (when configured).

## Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Zustand, React Router, `@azure/msal-browser` |
| API | Node.js, Express (`api/`), JWT validation (Entra), `mssql` for Azure SQL |
| Data | Azure SQL Database — schema in `db/migrations/` |
| Files | Azure Blob Storage (optional; attachment upload SAS) |
| IaC | Bicep (`infra/main.bicep`) — SQL, storage account, App Service, Application Insights |
| CI | Azure DevOps template (`azure-pipelines.yml`) |

## Prerequisites

- **Node.js 20+** and npm
- **Azure SQL Database** (or local SQL Server for development) and a connection string
- **Microsoft Entra ID** — SPA app registration + API app registration (exposed scope) for production sign-in

## Setup

### 1. Install dependencies

```bash
npm install
npm install --prefix api
```

### 2. Environment variables

**Frontend** — copy and edit:

```bash
cp .env.example .env
```

For production-style sign-in, set `VITE_AZURE_AD_CLIENT_ID`, `VITE_AZURE_AD_TENANT_ID`, and `VITE_AZURE_AD_API_SCOPE` (must match your API app registration).

**API** — copy and edit:

```bash
cp api/.env.example api/.env
```

Set `AZURE_SQL_CONNECTION_STRING` at minimum. For JWT validation, set `AZURE_AD_TENANT_ID` and `AZURE_AD_AUDIENCE` (API Application ID URI). Optional: `AZURE_STORAGE_CONNECTION_STRING` for attachment SAS.

### 3. Database migrations

Apply SQL migrations (from repo root):

```bash
npm --prefix api run migrate
```

Uses `AZURE_SQL_CONNECTION_STRING` from `api/.env` or the environment.

### 4. Run locally

**Option A — Full stack with Entra** — Start the API and the Vite dev server (Vite proxies `/api` to `http://127.0.0.1:3001`):

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev
```

**Option B — Local API without Entra (development only)** — In `api/.env` set `SKIP_AUTH=true`. In the frontend `.env` set `VITE_SKIP_AUTH=true` (optional `VITE_DEV_USER_JSON` for `X-TestVault-Dev-User`). Never enable `SKIP_AUTH` in production.

### 5. Tests

```bash
npm run test
npm run lint
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Vite dev server (proxies `/api` to the local API) |
| `npm run dev:api` | API server (`tsx watch`, default port `3001`) |
| `npm run build` | Typecheck SPA + Vite production build |
| `npm run preview` | Preview SPA build locally |
| `npm run lint` | ESLint (root + respects `eslint.config.js`) |
| `npm run test` | Vitest (frontend + `api/`) |
| `npm run test:watch` | Vitest watch mode (frontend) |
| `npm run deploy` | Placeholder — use Azure DevOps / your pipeline |

API-only: `npm --prefix api run build`, `npm --prefix api start`, `npm --prefix api run migrate`.

## Infrastructure (Bicep)

Deploy into an existing resource group (example):

```bash
az deployment group create \
  --resource-group <your-rg> \
  --template-file infra/main.bicep \
  --parameters baseName=<uniquePrefix> \
               sqlAdminPassword='<secure-password>' \
               azureAdTenantId='<tenant-guid>' \
               azureAdAudience='api://<api-app-id-or-uri>'
```

Outputs include SQL FQDN, storage account name, and API hostname. Add **blob** connection strings and any secrets via Key Vault or App Service configuration as your team requires. Attachments need `AZURE_STORAGE_CONNECTION_STRING` on the API if you use SAS upload.

## Integration API (CI / automation)

The HTTP API serves integration routes under **`/api/v1/projects/{projectId}`** (same paths as before; host is your deployed API or same-origin behind a reverse proxy).

Auth: `Authorization: Bearer <key>` or `X-TestVault-Api-Key: <key>`. Keys are stored in SQL (`integration_api_keys`).

### Create an API key

```bash
AZURE_SQL_CONNECTION_STRING='...' node api/scripts/create-integration-key.mjs <projectId>
```

`<projectId>` is the Test Vault **project id** (UUID used in URLs). Store the printed secret in your pipeline (e.g. Azure DevOps secret variable).

### T numbers and results

Each case in a run gets a **T number** (`T1`, `T2`, …). Submit results using `runTestNumber` in the JSON body; outcomes: `passed`, `failed`, `blocked`, `skipped`, `retest`.

### Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/v1/projects/{projectId}/runs` | Body: `{ "name", "caseNumbers": [1,2,3] }` or `{ "name", "caseIds": [...] }` |
| `GET` | `/api/v1/projects/{projectId}/runs/{runId}` | Run metadata and `runTestNumbers` |
| `POST` | `/api/v1/projects/{projectId}/runs/{runId}/results` | Single or batch results by `runTestNumber` |

Example:

```bash
export BASE=https://<your-api-host>
export PID=<projectId>
export KEY=<api_key>

curl -sS -X POST "$BASE/api/v1/projects/$PID/runs" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nightly","caseNumbers":[1,2,3]}'

curl -sS -X POST "$BASE/api/v1/projects/$PID/runs/<runId>/results" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"results":[{"runTestNumber":1,"outcome":"passed"}]}'
```

## Optional: Firestore → SQL

If you are migrating from an older Firebase-backed deployment, see `scripts/migrate-firestore-export.mjs` as a starting point for mapping exports to SQL (you will need to adapt it to your export format).

## First admin user

New Entra users get the **tester** role on first login. Promote someone to **admin** by updating the `users` table in Azure SQL (`role = 'admin'`) or your admin tooling.

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).
