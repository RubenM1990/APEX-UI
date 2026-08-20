import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APEX-UI — Autonomous-agent orb interface",
  description:
    "An open-source (MIT) animated orb + reasoning-graph UI. Hand-written SVG/CSS, no 3D libraries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
