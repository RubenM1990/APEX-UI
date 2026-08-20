"use client";

import { useEffect, useRef } from "react";

/**
 * ApexBackdrop — an original, dependency-free animated backdrop of drifting
 * wave lines. Written from scratch for this open-source release (MIT), it
 * replaces the previous WebGL shader. Renders on a 2D canvas; `active`
 * brightens and lifts the waves (driven by the orb's "speaking" state).
 */
export default function ApexBackdrop({ opacity = 0.12, active = false }: { opacity?: number; active?: boolean }) {
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
    // Re-measure whenever the canvas box changes — covers the case where the
    // parent has no size yet at mount (canvas would otherwise stay 0×0 and
    // never redraw until a window resize).
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const LINES = 20;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const boost = activeRef.current ? 1.5 : 1;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < LINES; i++) {
        const p = i / (LINES - 1);
        const baseY = h * (0.14 + p * 0.72);
        const amp = (10 + p * 34) * boost;
        const speed = 0.25 + p * 0.35;
        const freq = 0.6 + p * 0.5;

        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const nx = x / Math.max(w, 1);
          const y =
            baseY +
            Math.sin(nx * Math.PI * 2 * freq + t * speed) * amp +
            Math.sin(nx * Math.PI * 4 + t * speed * 0.6) * amp * 0.3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(90, 210, 255, ${(0.14 + p * 0.2) * boost})`;
        ctx.lineWidth = 1;
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
