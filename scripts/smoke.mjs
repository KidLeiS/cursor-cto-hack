#!/usr/bin/env node
/**
 * Production smoke: dashboard HTML, read APIs, and Supabase REST.
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
    if (!html.includes("sushicode is code")) {
      throw new Error("Landing page HTML missing expected text");
    }
  });
  console.log("Dashboard HTML OK");

  console.log("Smoke documentation API + seeded canvas");
  await retry("Documentation workspace", async () => {
    const health = await fetch(`${dashboardUrl}/api/docs/health`, {
      headers: { "user-agent": "cursor-cto-smoke/1.0" },
      redirect: "follow",
    });
    await mustOk(health, "documentation health");
    const payload = await health.json();
    if (!payload.ok || payload.status !== "ready" || payload.node_count < 10) {
      throw new Error(`Unexpected documentation health: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    const page = await fetch(`${dashboardUrl}/docs`, {
      headers: { "user-agent": "cursor-cto-smoke/1.0" },
      redirect: "follow",
    });
    await mustOk(page, "documentation page");
    const html = await page.text();
    if (!html.includes("Platform map") || !html.includes("Infrastructure")) {
      throw new Error("Documentation page is missing seeded canvas data");
    }
  });
  console.log("Documentation workspace OK");

  console.log("Smoke roadmap + task tracker APIs");
  await retry("Core read APIs", async () => {
    const [roadmapResponse, trackerResponse] = await Promise.all([
      fetch(`${dashboardUrl}/api/tasks`, {
        headers: { "user-agent": "cursor-cto-smoke/1.0" },
      }),
      fetch(`${dashboardUrl}/api/task-tracker`, {
        headers: { "user-agent": "cursor-cto-smoke/1.0" },
      }),
    ]);
    await mustOk(roadmapResponse, "roadmap API");
    await mustOk(trackerResponse, "task tracker API");

    const roadmap = await roadmapResponse.json();
    if (roadmap.source !== "supabase" || !Array.isArray(roadmap.data)) {
      throw new Error(`Unexpected roadmap payload: ${JSON.stringify(roadmap).slice(0, 200)}`);
    }

    const tracker = await trackerResponse.json();
    if (!tracker.ok || tracker.source !== "supabase" || !Array.isArray(tracker.data)) {
      throw new Error(`Unexpected task tracker payload: ${JSON.stringify(tracker).slice(0, 200)}`);
    }
  });
  console.log("Roadmap + task tracker APIs OK");

  console.log("Smoke DeepSeek server configuration");
  await retry("DeepSeek configuration", async () => {
    const response = await fetch(`${dashboardUrl}/api/task-tracker`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "cursor-cto-smoke/1.0",
      },
      body: JSON.stringify({
        input: "Validate server configuration without creating a task",
        time_zone: "Smoke/Invalid",
      }),
    });
    const payload = await response.json();
    if (response.status !== 422 || payload.code !== "invalid_output") {
      throw new Error(
        `Unexpected DeepSeek configuration response (${response.status}): ${JSON.stringify(payload).slice(0, 200)}`,
      );
    }
  });
  console.log("DeepSeek server configuration OK");
  console.log("Smoke passed");
}

main().catch((err) => {
  console.error("Smoke failed:", err.message);
  process.exit(1);
});
