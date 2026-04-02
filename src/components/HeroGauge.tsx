import { useRef, useEffect, useState } from "react";

interface HeroGaugeProps {
  score: number;
  size?: number;
}

// Saffron gradient: ks-saffron hsl(28 80% 54%) → warm amber hsl(39 90% 62%)
const SAFFRON_START = { h: 28, s: 0.80, l: 0.54 };
const SAFFRON_END   = { h: 39, s: 0.90, l: 0.62 };

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function HeroGauge({ score, size = 160 }: HeroGaugeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef<number>(0);

  // Score counter animation
  useEffect(() => {
    let current = 0;
    const step = () => {
      current += score / 50; // ~50 frames to reach target
      if (current >= score) {
        setAnimated(score);
        return;
      }
      setAnimated(Math.round(current));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.scale(dpr, dpr);
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.42;
    const trackW = size * 0.072;
    const startAngle = -Math.PI / 2;
    const progress = (animated / 100) * Math.PI * 2;

    ctx.clearRect(0, 0, size, size);

    // ── Track ring (subtle warm grey) ────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = trackW;
    ctx.lineCap = "round";
    ctx.stroke();

    // ── Saffron arc (gradient sweep) ─────────────────────────────────────────
    if (animated > 0) {
      // Build a conic-like gradient by creating a linear gradient across the arc bounding box
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      const [r1, g1, b1] = hslToRgb(SAFFRON_START.h, SAFFRON_START.s, SAFFRON_START.l);
      const [r2, g2, b2] = hslToRgb(SAFFRON_END.h, SAFFRON_END.s, SAFFRON_END.l);
      grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
      grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);

      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + progress);
      ctx.strokeStyle = grad;
      ctx.lineWidth = trackW;
      ctx.lineCap = "round";
      ctx.stroke();

      // ── Glow at tip ──────────────────────────────────────────────────────
      const tipX = cx + r * Math.cos(startAngle + progress);
      const tipY = cy + r * Math.sin(startAngle + progress);
      const glow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, trackW * 1.2);
      glow.addColorStop(0, `rgba(${r2},${g2},${b2},0.7)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(tipX, tipY, trackW * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // ── Score number ──────────────────────────────────────────────────────────
    ctx.font = `bold ${size * 0.28}px 'Playfair Display', 'DM Serif Display', serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(animated), cx, cy + size * 0.1);

    // ── Label ─────────────────────────────────────────────────────────────────
    ctx.font = `${size * 0.082}px 'DM Sans', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Overall Score", cx, cy + size * 0.24);
  }, [animated, size]);

  return <canvas ref={ref} aria-label={`Overall health score: ${score}`} />;
}
