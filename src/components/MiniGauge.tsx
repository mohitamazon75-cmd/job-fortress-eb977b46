import { useRef, useEffect, useState } from "react";

interface MiniGaugeProps {
  score: number;
  size?: number;
  /** Tailwind semantic color for track fill, e.g. hsl values */
  trackColor?: string;
}

// Saffron gradient stops
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

export function MiniGauge({ score, size = 72 }: MiniGaugeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let current = 0;
    const step = () => {
      current += score / 40;
      if (current >= score) { setAnimated(score); return; }
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
    const r = size * 0.40;
    const trackW = size * 0.10;
    const startAngle = -Math.PI / 2;
    const progress = (animated / 100) * Math.PI * 2;

    ctx.clearRect(0, 0, size, size);

    // Track ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = trackW;
    ctx.lineCap = "round";
    ctx.stroke();

    // Saffron arc
    if (animated > 0) {
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
    }

    // Score number (dark, since tile background is light)
    ctx.font = `bold ${size * 0.26}px 'Playfair Display', serif`;
    ctx.fillStyle = "#1A5C6B"; // ks-teal
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(animated), cx, cy);
  }, [animated, size]);

  return <canvas ref={ref} aria-label={`Score: ${score}`} />;
}
