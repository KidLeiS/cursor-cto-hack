import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dbHostFromSupabaseUrl,
  demoBundle,
  filterBundleForProject,
  hasSupabaseEnv,
  projectRefFromSupabaseUrl,
  stepsByWorkplan,
} from "../src/lib/domain";

describe("hasSupabaseEnv", () => {
  it("is false when env missing", () => {
    assert.equal(hasSupabaseEnv({}), false);
  });

  it("is true when url and anon key set", () => {
    assert.equal(
      hasSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJtest",
      }),
      true,
    );
  });

  it("accepts the shorter Vercel secret names", () => {
    assert.equal(
      hasSupabaseEnv({
        SB_URL: "https://abc.supabase.co",
        SB_PK: "eyJtest",
      }),
      true,
    );
  });
});

describe("projectRefFromSupabaseUrl", () => {
  it("parses ref from project URL", () => {
    assert.equal(
      projectRefFromSupabaseUrl("https://abcdefgh.supabase.co"),
      "abcdefgh",
    );
  });

  it("builds db host", () => {
    assert.equal(
      dbHostFromSupabaseUrl("https://abcdefgh.supabase.co"),
      "db.abcdefgh.supabase.co",
    );
  });
});

describe("demoBundle", () => {
  it("exposes feature and debug runs with workplans", () => {
    const bundle = demoBundle();
    assert.equal(bundle.source, "demo");
    assert.equal(bundle.project.slug, "cursor-cto-hack");
    assert.ok(bundle.agentRuns.some((r) => r.kind === "feature"));
    assert.ok(bundle.agentRuns.some((r) => r.kind === "debug"));
    assert.ok(bundle.workplans.length >= 2);
    assert.ok(bundle.steps.length >= 1);
  });
});

describe("filterBundleForProject", () => {
  it("drops gates and steps outside project runs/features", () => {
    const bundle = demoBundle();
    const filtered = filterBundleForProject({
      ...bundle,
      gates: [
        ...bundle.gates,
        {
          ...bundle.gates[0],
          id: "dead",
          feature_id: "00000000-0000-4000-8000-999999999999",
        },
      ],
      steps: [
        ...bundle.steps,
        {
          ...bundle.steps[0],
          id: "orphan-step",
          workplan_id: "00000000-0000-4000-8000-999999999998",
        },
      ],
    });
    assert.equal(
      filtered.gates.some((g) => g.id === "dead"),
      false,
    );
    assert.equal(
      filtered.steps.some((s) => s.id === "orphan-step"),
      false,
    );
  });
});

describe("stepsByWorkplan", () => {
  it("groups and sorts by sort_order", () => {
    const bundle = demoBundle();
    const map = stepsByWorkplan([
      { ...bundle.steps[0], sort_order: 2, id: "b", title: "second" },
      { ...bundle.steps[0], sort_order: 0, id: "a", title: "first" },
      { ...bundle.steps[0], sort_order: 1, id: "c", title: "mid" },
    ]);
    const list = map.get(bundle.steps[0].workplan_id)!;
    assert.deepEqual(
      list.map((s) => s.id),
      ["a", "c", "b"],
    );
  });
});
