#!/usr/bin/env node
/**
 * Production smoke: dashboard HTML + Supabase REST with SB_PK / SB_URL.
 * Env: SB_URL, SB_PK, DASHBOARD_URL (Vercel deployment URL)
 */

async function mustOk(res, label) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${label} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(label, fn, attempts = 24, delayMs = 10_000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.log(`${label} not ready (${attempt}/${attempts}); retrying...`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function main() {
  const sbUrl = process.env.SB_URL?.replace(/\/$/, "");
  const sbPk = process.env.SB_PK;
  const dashboardUrl = process.env.DASHBOARD_URL?.replace(/\/$/, "");

  if (!sbUrl || !sbPk) {
    console.error("Missing SB_URL or SB_PK");
    process.exit(1);
  }
  if (!dashboardUrl) {
    console.error("Missing DASHBOARD_URL");
    process.exit(1);
  }

  console.log("Smoke Supabase REST: projects");
  await retry("Supabase migration", async () => {
    const rest = await fetch(
      `${sbUrl}/rest/v1/projects?slug=eq.cursor-cto-hack&select=slug,name`,
      {
        headers: {
          apikey: sbPk,
          Authorization: `Bearer ${sbPk}`,
          Accept: "application/json",
        },
      },
    );
    await mustOk(rest, "supabase projects");
    const rows = await rest.json();
    if (!Array.isArray(rows) || rows.length < 1 || rows[0].slug !== "cursor-cto-hack") {
      throw new Error(`Unexpected projects payload: ${JSON.stringify(rows).slice(0, 200)}`);
    }
  });
  console.log("Supabase REST OK");

  console.log(`Smoke dashboard: ${dashboardUrl}`);
  await retry("Vercel dashboard", async () => {
    const page = await fetch(dashboardUrl, {
      headers: { "user-agent": "cursor-cto-smoke/1.0" },
      redirect: "follow",
    });
    await mustOk(page, "dashboard");
    const html = await page.text();
    for (const needle of ["Cursor CTO", "Feature agents", "Debug agents"]) {
      if (!html.includes(needle)) {
        throw new Error(`Dashboard HTML missing expected text: ${needle}`);
      }
    }
    if (!html.includes('data-context-source="supabase"')) {
      throw new Error("Dashboard is not using Supabase context");
    }
  });
  console.log("Dashboard HTML OK");
  console.log("Smoke passed");
}

main().catch((err) => {
  console.error("Smoke failed:", err.message);
  process.exit(1);
});
