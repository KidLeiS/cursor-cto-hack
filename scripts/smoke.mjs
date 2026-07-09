#!/usr/bin/env node
/**
 * Production smoke: auth gate, public health, and anonymous RLS denial.
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

  console.log("Smoke Supabase anonymous RLS");
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
    if (!Array.isArray(rows) || rows.length !== 0) {
      throw new Error(`Unexpected projects payload: ${JSON.stringify(rows).slice(0, 200)}`);
    }
  });
  console.log("Anonymous Supabase access denied by RLS");

  console.log(`Smoke authentication gate: ${dashboardUrl}`);
  await retry("Vercel dashboard", async () => {
    const page = await fetch(dashboardUrl, {
      headers: { "user-agent": "cursor-cto-smoke/1.0" },
      redirect: "follow",
    });
    await mustOk(page, "dashboard");
    const html = await page.text();
    if (!html.includes("Sushicode private beta")) {
      throw new Error("Login page HTML missing expected text");
    }
  });
  console.log("Authentication gate OK");

  console.log("Smoke public health");
  await retry("Service health", async () => {
    const health = await fetch(`${dashboardUrl}/api/health`, {
      headers: { "user-agent": "cursor-cto-smoke/1.0" },
      redirect: "follow",
    });
    await mustOk(health, "service health");
    const payload = await health.json();
    if (!payload.ok || payload.status !== "ready" || payload.authentication !== "required") {
      throw new Error(`Unexpected service health: ${JSON.stringify(payload).slice(0, 200)}`);
    }
  });
  console.log("Service health OK");

  console.log("Smoke protected APIs");
  await retry("Protected API", async () => {
    const response = await fetch(`${dashboardUrl}/api/tasks`, {
      headers: { "user-agent": "cursor-cto-smoke/1.0" },
      redirect: "manual",
    });
    if (response.status !== 401) {
      throw new Error(`Protected roadmap API returned ${response.status}, expected 401`);
    }
  });
  console.log("Protected APIs reject anonymous callers");
  console.log("Smoke passed");
}

main().catch((err) => {
  console.error("Smoke failed:", err.message);
  process.exit(1);
});
