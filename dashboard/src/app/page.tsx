export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 className="brand">sushicode is code</h1>
        <a className="landing-docs-link" href="/docs">
          Open documentation
        </a>
      </div>
    </main>
  );
}
