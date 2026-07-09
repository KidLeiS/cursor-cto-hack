import { WorkplanStepEditor } from "@/components/WorkplanStepEditor";
import { loadDashboardBundle } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await loadDashboardBundle();
  const workplanByRun = new Map(data.workplans.map((w) => [w.agent_run_id, w]));
  const stepsByPlan = new Map<string, typeof data.steps>();
  for (const step of data.steps) {
    const list = stepsByPlan.get(step.workplan_id) ?? [];
    list.push(step);
    stepsByPlan.set(step.workplan_id, list);
  }
  for (const [, list] of stepsByPlan) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }

  const featureRuns = data.agentRuns.filter((r) => r.kind === "feature");
  const debugRuns = data.agentRuns.filter((r) => r.kind === "debug");

  return (
    <main>
      <header className="hero">
        <p className="pill">
          <strong>Cursor CTO</strong> · iOS hack · Cursor + Supabase
        </p>
        <h1 className="brand">Cursor CTO</h1>
        <p className="lede">
          Shared context for Feature and Debug agents. Edit workplans here —
          implementers always re-read from Supabase before coding.
        </p>
        <div className="meta">
          <span className="pill">
            project <strong>{data.project.slug}</strong>
          </span>
          <span className="pill" data-context-source={data.source}>
            source <strong>{data.source}</strong>
          </span>
          {data.project.repo_url ? (
            <a className="pill" href={data.project.repo_url} target="_blank" rel="noreferrer">
              repo
            </a>
          ) : null}
        </div>
      </header>

      <div className="grid two">
        <section>
          <h2>Modules</h2>
          <p className="hint">Platform building blocks agents should prefer extending.</p>
          <div className="list">
            {data.modules.length === 0 ? (
              <p className="empty">No modules yet.</p>
            ) : (
              data.modules.map((m) => (
                <div className="row" key={m.id}>
                  <div className="row-title">
                    <h3>{m.name}</h3>
                    <span className="pill mono">{m.slug}</span>
                  </div>
                  <p className="muted">{m.purpose}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2>Features & gates</h2>
          <p className="hint">High-level validation contracts for Feature agents.</p>
          <div className="list">
            {data.features.length === 0 ? (
              <p className="empty">No features yet.</p>
            ) : (
              data.features.map((f) => {
                const gates = data.gates
                  .filter((g) => g.feature_id === f.id)
                  .sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div className="row" key={f.id}>
                    <div className="row-title">
                      <h3>{f.title}</h3>
                      <span className={`pill ${f.status}`}>{f.status}</span>
                    </div>
                    <p className="muted">{f.summary}</p>
                    <div className="meta" style={{ marginTop: "0.4rem" }}>
                      {gates.map((g) => (
                        <span key={g.id} className={`pill ${g.status}`} title={g.criteria}>
                          {g.title}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section style={{ marginTop: "1.75rem" }}>
        <h2>Feature agents</h2>
        <p className="hint">
          Intent → modules + gates + workplan. Edit steps below before implement runs.
        </p>
        <AgentRunList
          runs={featureRuns}
          workplanByRun={workplanByRun}
          stepsByPlan={stepsByPlan}
          kind="feature"
        />
      </section>

      <section style={{ marginTop: "1.75rem" }}>
        <h2>Debug agents</h2>
        <p className="hint">
          Symptom → triage + minimal fix workplan. Same edit contract as Feature.
        </p>
        <AgentRunList
          runs={debugRuns}
          workplanByRun={workplanByRun}
          stepsByPlan={stepsByPlan}
          kind="debug"
          debugCases={data.debugCases}
        />
      </section>
    </main>
  );
}

function AgentRunList({
  runs,
  workplanByRun,
  stepsByPlan,
  kind,
  debugCases = [],
}: {
  runs: Awaited<ReturnType<typeof loadDashboardBundle>>["agentRuns"];
  workplanByRun: Map<
    string,
    Awaited<ReturnType<typeof loadDashboardBundle>>["workplans"][number]
  >;
  stepsByPlan: Map<
    string,
    Awaited<ReturnType<typeof loadDashboardBundle>>["steps"]
  >;
  kind: "feature" | "debug";
  debugCases?: Awaited<ReturnType<typeof loadDashboardBundle>>["debugCases"];
}) {
  if (runs.length === 0) {
    return <p className="empty">No {kind} runs yet.</p>;
  }

  return (
    <div className="workplan">
      {runs.map((run) => {
        const plan = workplanByRun.get(run.id);
        const steps = plan ? (stepsByPlan.get(plan.id) ?? []) : [];
        const debug = debugCases.find((d) => d.agent_run_id === run.id);
        return (
          <div className="row" key={run.id} style={{ paddingBottom: "1.25rem" }}>
            <div className="row-title">
              <h3>{run.title}</h3>
              <div className="meta">
                <span className={`pill ${kind}`}>{kind}</span>
                <span className={`pill ${run.status}`}>{run.status}</span>
                <span className="pill mono">{run.harness}</span>
              </div>
            </div>
            <p className="muted">{run.intent}</p>
            {debug ? (
              <p className="muted">
                <strong>Symptom:</strong> {debug.symptom}
              </p>
            ) : null}
            {plan ? (
              <>
                <p className="muted" style={{ marginTop: "0.6rem" }}>
                  <strong>Workplan v{plan.version}:</strong> {plan.summary}
                  {plan.editable ? " · editable" : " · locked"}
                </p>
                {plan.architecture_notes ? (
                  <p className="muted">{plan.architecture_notes}</p>
                ) : null}
                {steps.length === 0 ? (
                  <p className="empty">No steps.</p>
                ) : (
                  steps.map((step) => (
                    <WorkplanStepEditor key={step.id} step={step} />
                  ))
                )}
              </>
            ) : (
              <p className="empty">No workplan attached yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
