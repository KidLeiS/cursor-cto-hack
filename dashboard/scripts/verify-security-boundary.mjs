#!/usr/bin/env node

// Production deploy gate: do not let Vercel promote the authenticated app while
// the database still has the legacy anonymous policies. Preview and local builds
// do not gate because migration 008 is intentionally applied only from main.

if (process.env.VERCEL_ENV !== "production") {
  console.log("Security boundary gate skipped outside Vercel production.");
  process.exit(0);
}

const sbUrl = (process.env.SB_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(
  /\/$/,
  "",
);
const sbKey = process.env.SB_PK || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!sbUrl || !sbKey) {
  console.error("Security boundary gate requires SB_URL and SB_PK.");
  process.exit(1);
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

for (let attempt = 1; attempt <= 30; attempt += 1) {
  const response = await fetch(`${sbUrl}/rest/v1/projects?select=id&limit=1`, {
    headers: {
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      Accept: "application/json",
    },
  });
  if (response.ok) {
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length === 0) {
      console.log("Security boundary verified: anonymous project reads are denied.");
      process.exit(0);
    }
  }
  console.log(`Waiting for RLS security migration (${attempt}/30)...`);
  await sleep(10_000);
}

console.error(
  "Refusing production deploy: anonymous Supabase project access remains open.",
);
process.exit(1);
