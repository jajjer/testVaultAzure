#!/usr/bin/env node
/**
 * Optional one-off migration helper: maps a Firestore JSON export shape into SQL INSERT hints.
 *
 * Firestore export formats vary (NDJSON per collection, or Firebase console JSON).
 * This script documents the expected mapping; adjust paths to match your export tool.
 *
 * Usage:
 *   node scripts/migrate-firestore-export.mjs ./path/to/users.json ./path/to/projects.json
 *
 * Outputs SQL fragments to stdout — review and run against Azure SQL after schema migration.
 */
import { readFile } from "node:fs/promises";

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error(
      "Usage: node scripts/migrate-firestore-export.mjs <json-files...>"
    );
    process.exit(1);
  }

  for (const f of files) {
    const raw = await readFile(f, "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error(`Skip or fix invalid JSON: ${f}`);
      continue;
    }
    console.log(`-- File: ${f}`);
    console.log(
      "-- Inspect structure and generate INSERTs into users, projects, project_members, test_cases, test_runs, run_results as needed."
    );
    console.log(JSON.stringify(data, null, 2).slice(0, 2000));
    console.log("");
  }

  console.log(
    `-- Example user insert (adjust column names to match ${"db/migrations/001_initial.sql"}):`
  );
  console.log(
    `INSERT INTO users (uid, email, display_name, role, created_at, updated_at) VALUES ('${esc("oid-from-entra")}', '${esc("user@contoso.com")}', '${esc("Name")}', 'tester', 0, 0);`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
