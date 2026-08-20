"use client";

/**
 * OVERVIEW lamp panel - same design as the Apex app's top-left HUD
 * (OverviewMode.jsx): glowing filament line + sliding node + "OVERVIEW"
 * label, live clock/date and Tel-Aviv weather (open-meteo, same endpoint
 * as the app).
 *
 * Clicking the lamp opens the tiles. They are deliberately three different
 * kinds of thing, and each says which it is before it is pressed: "What is
 * Apex" opens the story overlay, "develop your own" goes to the guide, and the
 * three social tiles leave the site (marked with an arrow, and they open in a
 * new tab so nobody loses the page they were on).
 */

import { useEffect, useState } from "react";
import { Sparkles, Instagram, Facebook, Linkedin, ArrowUpRight } from "lucide-react";

const ACCENT = "#00e5ff";
const WCODE: Record<number, string> = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Snow", 80: "Showers", 81: "Showers", 82: "Showers", 95: "Storm", 96: "Storm", 99: "Storm" };

type Tile = { key: string; icon: typeof Sparkles; label: string; href: string };

// Social links stay live — they point to public profiles. Swap them for your own.
const TILES: Tile[] = [
  { key: "instagram", icon: Instagram, label: "Follow us on Instagram", href: "https://www.instagram.com/reznikov_engineering/" },
  { key: "facebook",  icon: Facebook,  label: "Follow us on Facebook",  href: "https://www.facebook.com/profile.php?id=61590746065386" },
  { key: "linkedin",  icon: Linkedin,  label: "Follow us on LinkedIn",  href: "https://www.linkedin.com/in/ruben-mouradian-150698173" },
];

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  const [wx, setWx] = useState<{ temp: number | null; code: number | null; city: string } | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let ok = true;
    // Via our own API route, so open-meteo never sees visitor IPs. The route
    // returns the visitor's own city + weather (Vercel geo headers).
    const load = () =>
      fetch("/api/weather")
        .then((r) => r.json())
        .then((d) => { if (ok) setWx({ temp: d.current?.temperature_2m ?? null, code: d.current?.weather_code ?? null, city: d.city || "your town" }); })
        .catch(() => {});
    load();
    const id = setInterval(load, 1200000);
    return () => { ok = false; clearInterval(id); };
  }, []);

  if (!now) return <div style={{ height: 48 }} />;
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 26, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "0.04em", color: "#f0ede8", lineHeight: 1, textShadow: `0 0 22px ${ACCENT}33` }}>{time}</div>
        <div style={{ fontSize: 10.5, letterSpacing: "0.2em", color: "rgba(240,237,232,0.55)", marginTop: 4, textTransform: "uppercase" }}>{date}</div>
      </div>
      {wx && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 300, color: `${ACCENT}e6` }}>{wx.temp != null ? Math.round(wx.temp) + "°C" : "-"}</div>
          <div style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(240,237,232,0.5)", marginTop: 2, textTransform: "uppercase" }}>
            {(wx.city || "").toUpperCase()}{wx.city && wx.code != null ? " · " : ""}{wx.code != null ? (WCODE[wx.code] || "").toUpperCase() : ""}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApexOverviewPanel() {
  const [open, setOpen] = useState(false);
  const FIL = open ? 480 : 320; // filament width - grows when lit

  /**
   * How long the filament may actually get.
   *
   * The "Site home" pill sits at the top right of /apex, on the same line as
   * this lamp, and the filament used to run straight under it - and the node
   * that slides to the far end when the lamp opens parked underneath it. The
   * 184px is that pill's real estate: 8px lamp inset + up to 40px page inset +
   * ~124px of pill + a gap. On anything wider than a phone FIL wins and this
   * never applies; it only bites where the two would actually meet.
   */
  const FIL_CAP = "calc(100vw - 184px)";

  // One look for all five tiles: they sit in a list and a tile that changed
  // shape when pressed would read as a different kind of control.
  const tileStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, padding: "11px 14px",
    background: "rgba(6,14,26,0.72)", border: `1px solid ${ACCENT}2a`,
    borderRadius: 10, cursor: "pointer", textAlign: "left",
    backdropFilter: "blur(8px)", transition: "all .2s",
    color: "rgba(240,237,232,0.9)", textDecoration: "none", width: "100%",
  };

  const inner = (Icon: typeof Sparkles, label: string, external?: boolean) => (
    <>
      <span style={{ display: "flex", color: ACCENT }}><Icon size={16} /></span>
      <span style={{ flex: 1, fontSize: 11.5, letterSpacing: "0.05em", lineHeight: 1.2 }}>{label}</span>
      {external && <ArrowUpRight size={12} style={{ color: `${ACCENT}88`, flex: "none" }} />}
    </>
  );

  return (
    <div className="apex-overview" style={{ pointerEvents: "none" }}>
      {/* downward glow cone */}
      <div style={{
        position: "absolute", top: 14, left: 8, width: "min(520px, 94vw)", height: 240, pointerEvents: "none",
        background: `radial-gradient(ellipse 48% 70% at 46% 0%, ${ACCENT}${open ? "55" : "28"}, ${ACCENT}0a 46%, transparent 72%)`,
        filter: "blur(10px)", transition: "all .5s ease",
      }} />

      {/* filament line + sliding node + click target */}
      <div
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        role="button" tabIndex={0} aria-label="Toggle overview panel" aria-expanded={open}
        style={{ position: "relative", height: 40, cursor: "pointer", pointerEvents: "auto", userSelect: "none" }}
      >
        <div style={{
          position: "absolute", top: 14, left: 8, width: `min(${FIL}px, ${FIL_CAP})`, height: 2, borderRadius: 2,
          background: "#a5f3fc",
          boxShadow: `0 0 10px ${ACCENT}, 0 0 26px ${ACCENT}${open ? ", 0 0 54px " + ACCENT : ""}`,
          transition: "all .5s ease",
        }} />
        {/* the node that slides to the right end when the panel opens */}
        <div style={{
          // Rides the end of the filament, so it has to obey the same cap or it
          // parks itself on top of the Site home button.
          position: "absolute", top: 11, left: open ? `min(${FIL}px, ${FIL_CAP})` : 6, width: 8, height: 8, borderRadius: "50%",
          background: "#e0fbff", boxShadow: `0 0 10px ${ACCENT}, 0 0 18px ${ACCENT}`,
          transition: "left .5s ease", pointerEvents: "none",
        }} />
        <span style={{
          position: "absolute", top: 20, left: 10, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.34em",
          color: `rgba(165,243,252,${open ? 0.9 : 0.55})`, transition: "color .4s",
        }}>OVERVIEW</span>
      </div>

      {/* clock + weather inside the lit cone */}
      <div style={{ paddingLeft: 14, paddingTop: 6, width: "fit-content", pointerEvents: "auto" }}>
        <Clock />

        {/* tiles - appear when the lamp is lit */}
        {open && (
          <div style={{ marginTop: 16, width: 250, display: "flex", flexDirection: "column", gap: 8 }}>
            {TILES.map(({ key, icon: Icon, label, href }) => (
              // rel on every external link: noopener is a security matter, not a
              // preference, once target is _blank.
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" style={tileStyle}>
                {inner(Icon, label, true)}
              </a>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
