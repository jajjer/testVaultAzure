# Railyard

Self-hosted, Firebase-backed test management: projects, nested folders for test cases, test runs, and pass/fail results—similar in spirit to tools like TestRail, but under your own Firebase project.

## Features

- **Auth & roles** — Email/password sign-in; `admin`, `test_lead`, and `tester` roles (Firestore rules + UI).
- **Projects** — Multi-project workspace with optional parameters metadata.
- **Test cases** — Titles, steps, priority/type/status, custom fields, TestRail-style case IDs (`C1`, `C2`, …).
- **Folders** — Nested sections; drag-and-drop or dialogs to move cases; folder-scoped selection when building test runs.
- **Test runs** — Snapshot a set of cases (by folder or individually), edit runs, record results per case.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Zustand, React Router, Vitest for unit tests.
- **Backend:** Firebase (Authentication, Firestore, Storage), security rules in-repo (`firestore.rules`, `storage.rules`).

## Prerequisites

- Node.js 20+ (or current LTS) and npm
- A [Firebase](https://console.firebase.google.com/) project with **Authentication** (Email/Password), **Firestore**, and **Storage** enabled

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables and add your Firebase web app config:

   ```bash
   cp .env.example .env
   ```

   Fill in all `VITE_FIREBASE_*` values from **Project settings → Your apps** in the Firebase console. `VITE_FIREBASE_MEASUREMENT_ID` is optional (Analytics).

3. Deploy Firestore and Storage rules (from the project directory, with [Firebase CLI](https://firebase.google.com/docs/cli) logged in):

   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Run unit tests (optional):

   ```bash
   npm run test
   ```

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Vite dev server                     |
| `npm run build`     | Typecheck + production build        |
| `npm run preview`   | Preview production build locally    |
| `npm run lint`      | ESLint                              |
| `npm run test`      | Vitest (single run)                 |
| `npm run test:watch`| Vitest in watch mode                |

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).
