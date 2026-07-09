import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <div className="hero">
        <h1 className="brand">sushicode is code</h1>
        <p className="lede">
          Shared architecture, documentation, and executable roadmaps for cloud
          agents.
        </p>
        <div className="actions">
          <Link className="button-link" href="/tasks">
            Open roadmap
          </Link>
        </div>
      </div>
    </main>
  );
}
