#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql using SB_URL + SB_PW (GitHub Actions secrets).
 * Never prints password or full connection string.
 *
 * Env:
 *   SB_URL  https://<ref>.supabase.co
 *   SB_PW   database password
 *   SB_DB_HOST (optional) override host
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function projectRefFromUrl(url) {
  const u = new URL(url);
  const host = u.hostname;
  const ref = host.split(".")[0];
  if (!ref || ref === "supabase") {
    throw new Error(`Could not parse project ref from SB_URL host: ${host}`);
  }
  return ref;
}

async function connectWithFallback(ref, password) {
  const attempts = process.env.SB_DB_HOST
    ? [
        {
          label: "SB_DB_HOST override",
          config: {
            host: process.env.SB_DB_HOST,
            port: Number(process.env.SB_DB_PORT || 5432),
            user: process.env.SB_DB_USER || "postgres",
          },
        },
      ]
    : [
        {
          label: "direct db.<ref>.supabase.co",
          config: { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
        },
        {
          label: "pooler session mode",
          config: {
            host: `aws-0-eu-west-1.pooler.supabase.com`,
            port: 5432,
            user: `postgres.${ref}`,
          },
        },
        {
          label: "pooler us-east-1 session",
          config: {
            host: `aws-0-us-east-1.pooler.supabase.com`,
            port: 5432,
            user: `postgres.${ref}`,
          },
        },
      ];

  let lastError;
  for (const attempt of attempts) {
    const client = new Client({
      ...attempt.config,
      database: "postgres",
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
    });
    try {
      console.log(`Connecting via ${attempt.label} (${attempt.config.host})...`);
      await client.connect();
      console.log(`Connected via ${attempt.label}`);
      return client;
    } catch (err) {
      lastError = err;
      console.warn(`Failed ${attempt.label}: ${err.message}`);
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastError ?? new Error("No DB connection attempts configured");
}

async function main() {
  const sbUrl = process.env.SB_URL;
  const sbPw = process.env.SB_PW;
  if (!sbUrl || !sbPw) {
    console.error("Missing SB_URL or SB_PW");
    process.exit(1);
  }

  const ref = projectRefFromUrl(sbUrl);
  const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("No migration files found");
    process.exit(1);
  }

  console.log(`Migrating project ref=${ref} files=${files.length}`);

  const client = await connectWithFallback(ref, sbPw);
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);
      await client.query(sql);
      console.log(`OK ${file}`);
    }

    const { rows } = await client.query(
      "select slug, name from public.projects where slug = $1",
      ["cursor-cto-hack"],
    );
    if (!rows.length) {
      throw new Error("Seed project cursor-cto-hack missing after migrate");
    }
    console.log(`Seed OK: ${rows[0].slug}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migrate failed:", err.message);
  process.exit(1);
});
