import ApexWorld from "@/components/ApexWorld";
import ApexOverviewPanel from "@/components/ApexOverviewPanel";

export default function Home() {
  return (
    <main
      id="main"
      style={{ background: "#04080f", color: "#f0ede8", position: "relative", overflow: "hidden" }}
    >
      {/* Top-left overview HUD: clock + weather + social links */}
      <ApexOverviewPanel />

      {/* The world: orb core + orbiting agent graph. Tap the orb to cycle its
          state; click any agent node to open its overview card. */}
      <section style={{ position: "relative", height: "100vh", minHeight: 620 }}>
        <ApexWorld />
      </section>

      {/* Repo link — remove or replace for your own use */}
      <a
        href="https://github.com/RubenM1990/APEX-UI"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "absolute", top: 16, right: "clamp(16px,3vw,40px)", zIndex: 40,
          fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.24em",
          textTransform: "uppercase", color: "rgba(240,237,232,0.7)", textDecoration: "none",
          border: "1px solid rgba(240,237,232,0.2)", borderRadius: 20, padding: "7px 15px",
          background: "rgba(4,8,15,0.5)", backdropFilter: "blur(6px)",
        }}
      >
        View on GitHub ↗
      </a>
    </main>
  );
}
