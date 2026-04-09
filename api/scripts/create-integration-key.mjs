#!/usr/bin/env node
/**
 * Inserts a hashed API key into integration_api_keys for automation (replaces Firestore script).
 *
 * Usage:
 *   AZURE_SQL_CONNECTION_STRING=... node api/scripts/create-integration-key.mjs <projectId>
 *
 * Prints the secret once (store in Azure DevOps / Key Vault).
 */
import * as crypto from "node:crypto";

import sql from "mssql";

const projectIdArg = process.argv[2];

if (!projectIdArg) {
  console.error(
    "Usage: AZURE_SQL_CONNECTION_STRING=... node api/scripts/create-integration-key.mjs <projectId>"
  );
  process.exit(1);
}

const cs = process.env.AZURE_SQL_CONNECTION_STRING;
if (!cs) {
  console.error("AZURE_SQL_CONNECTION_STRING is required");
  process.exit(1);
}

function hashApiKey(secret) {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

const secret = `tvk_${crypto.randomBytes(32).toString("hex")}`;
const keyHash = hashApiKey(secret);

const pool = await sql.connect(cs);
try {
  await pool
    .request()
    .input("h", sql.NVarChar, keyHash)
    .input("pid", sql.NVarChar, projectIdArg)
    .query(
      `INSERT INTO integration_api_keys (key_hash, project_id) VALUES (@h, @pid)`
    );
} finally {
  await pool.close();
}

console.log("");
console.log("API key (store as a secret — shown once):");
console.log(secret);
console.log("");
