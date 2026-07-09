import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <div className="hero">
        <h1 className="brand">sushicode is code</h1>
        <p className="lede">
          Client tasks, shared documentation, and executable roadmaps for cloud
          agents and product teams.
        </p>
        <div className="actions">
          <Link className="button-link" href="/tracker">
            Open task tracker
          </Link>
          <Link className="button-quiet" href="/docs">
            Open documentation
          </Link>
          <Link className="button-quiet" href="/tasks">
            Open roadmap
          </Link>
        </div>
      </div>
    </main>
  );
}
