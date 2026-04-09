/**
 * Applies SQL files from ../../db/migrations in order (split on GO).
 * Records applied files in schema_migrations.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sql from "mssql";

import { sqlConnectionString } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  if (!sqlConnectionString) {
    throw new Error("AZURE_SQL_CONNECTION_STRING is required");
  }
  const pool = await sql.connect(sqlConnectionString);
  try {
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
      CREATE TABLE dbo.schema_migrations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        filename NVARCHAR(256) NOT NULL UNIQUE,
        applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    `);

    const migDir = path.join(__dirname, "..", "..", "db", "migrations");
    const files = (await readdir(migDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      const chk = await pool
        .request()
        .input("fn", sql.NVarChar, filename)
        .query(
          `SELECT 1 AS x FROM schema_migrations WHERE filename = @fn`
        );
      if (chk.recordset.length > 0) {
        console.log(`[migrate] skip ${filename}`);
        continue;
      }

      const full = path.join(migDir, filename);
      const sqlText = await readFile(full, "utf8");
      const batches = sqlText.split(/^\s*GO\s*$/gim);
      for (const batch of batches) {
        const t = batch.trim();
        if (!t) continue;
        await pool.request().query(t);
      }
      await pool
        .request()
        .input("fn", sql.NVarChar, filename)
        .query(`INSERT INTO schema_migrations (filename) VALUES (@fn)`);
      console.log(`[migrate] applied ${filename}`);
    }
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
