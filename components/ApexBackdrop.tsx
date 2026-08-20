"use client";

import { useEffect, useRef } from "react";

/**
 * ApexBackdrop — an original, dependency-free animated backdrop of warped,
 * flowing wave lines. Written from scratch for this open-source release (MIT);
 * it replaces the previous WebGL shader.
 *
 * `active` (driven by the orb's tap state) makes the whole field **accelerate**
 * and brighten, so the backdrop moves with the particle core instead of
 * ignoring it. The speed eases in/out rather than snapping.
 */
export default function ApexBackdrop({ opacity = 0.5, active = false }: { opacity?: number; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    // Re-measure whenever the canvas box changes (covers a 0×0 measure at mount).
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const LINES = 26;
    let phase = 0; // accumulates faster when active — the "moves with the particles" part
    let speed = 1; // eased current speed
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Accelerate toward the target speed when the orb is engaged; ease back down.
      const target = activeRef.current ? 3.0 : 1.0;
      speed += (target - speed) * 0.06;
      phase += dt * speed;

      const glow = activeRef.current ? 1.4 : 1;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < LINES; i++) {
        const p = i / (LINES - 1);
        const baseY = h * (0.08 + p * 0.84);
        const amp = 14 + p * 46;
        const freq = 0.5 + p * 0.7;
        const wavePhase = phase * (0.6 + p * 0.5) + p * 6.283;

        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const nx = x / Math.max(w, 1);
          // A long, slow warp bends the whole line so the field curves and
          // swirls instead of running flat; a faster wave rides on top.
          const warp = Math.sin(nx * Math.PI * 1.3 + phase * 0.4 + p * 2) * amp * 0.9;
          const y = baseY + Math.sin(nx * Math.PI * 2 * freq + wavePhase) * amp * 0.55 + warp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(80, 200, 255, ${(0.12 + p * 0.22) * glow})`;
        ctx.lineWidth = 0.6 + p * 0.9;
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity }}
    />
  );
}
