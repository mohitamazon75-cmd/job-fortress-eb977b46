import { useRef, useEffect, useState } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
  colorClass?: "success" | "warning" | "destructive" | "primary" | "info" | "accent";
}

const COLOR_MAP: Record<string, string> = {
  success: "145 56% 42%",
  warning: "28 80% 52%",
  destructive: "4 70% 46%",
  primary: "160 48% 20%",
  info: "204 64% 44%",
  accent: "39 59% 58%",
};

export function ScoreRing({ score, size = 120, label, colorClass = "primary" }: ScoreRingProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let s = 0;
    const f = () => {
      s += 2;
      if (s > score) s = score;
      setAnimatedScore(s);
      if (s < score) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
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
    c.style.width = size + "px";
    c.style.height = size + "px";

    const cx = size / 2, cy = size / 2, r = size * 0.4;
    const color = COLOR_MAP[colorClass] || COLOR_MAP.primary;

    ctx.clearRect(0, 0, size, size);

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#F0EDE8";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();

    // Progress
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * animatedScore) / 100);
    ctx.strokeStyle = `hsl(${color})`;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score text
    ctx.font = `bold ${size * 0.22}px 'DM Serif Display', serif`;
    ctx.fillStyle = "#1A1A1A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(animatedScore), cx, cy - 4);

    if (label) {
      ctx.font = `${size * 0.085}px 'DM Sans', sans-serif`;
      ctx.fillStyle = "#8A8A8A";
      ctx.fillText(label, cx, cy + size * 0.16);
    }
  }, [animatedScore, size, label, colorClass]);

  return <canvas ref={ref} />;
}
