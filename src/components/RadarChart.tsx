import { useRef, useEffect } from "react";

interface RadarChartProps {
  data: number[];
  labels: string[];
  size?: number;
  showBenchmark?: boolean;
}

export function RadarChart({ data, labels, size = 280, showBenchmark = false }: RadarChartProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";

    // Reserve left margin for ring labels; chart centre shifts right slightly
    const labelMargin = 52;
    const cx = size / 2 + labelMargin / 4;
    const cy = size / 2;
    const r = (size - labelMargin) * 0.38;
    const n = data.length;
    ctx.clearRect(0, 0, size, size);

    const styles = getComputedStyle(document.documentElement);
    const borderColor = styles.getPropertyValue("--border").trim();
    const primaryHsl = styles.getPropertyValue("--primary").trim();

    // Grid rings
    for (let lv = 1; lv <= 5; lv++) {
      ctx.beginPath();
      const lr = (r * lv) / 5;
      for (let i = 0; i <= n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        if (i === 0) { ctx.moveTo(cx + lr * Math.cos(a), cy + lr * Math.sin(a)); }
        else { ctx.lineTo(cx + lr * Math.cos(a), cy + lr * Math.sin(a)); }
      }
      ctx.strokeStyle = lv === 5 ? `hsl(${borderColor})` : "#F0EDE8";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Axis lines
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      ctx.strokeStyle = "#E8E5DF";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Percentile scale rings: 25th, 50th, 75th
    const RING_LABELS: { pct: number; label: string; color: string; solidColor: string }[] = [
      { pct: 25, label: "25th pct", color: "rgba(220,100,80,0.45)", solidColor: "rgba(220,100,80,0.8)" },
      { pct: 50, label: "50th avg", color: "rgba(130,130,130,0.45)", solidColor: "rgba(130,130,130,0.8)" },
      { pct: 75, label: "75th pct", color: "rgba(60,170,100,0.45)", solidColor: "rgba(60,170,100,0.8)" },
    ];

    if (showBenchmark) {
      RING_LABELS.forEach(({ pct, label, color, solidColor }) => {
        const br = (r * pct) / 100;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (Math.PI * 2 * i) / n - Math.PI / 2;
          if (i === 0) { ctx.moveTo(cx + br * Math.cos(a), cy + br * Math.sin(a)); }
          else { ctx.lineTo(cx + br * Math.cos(a), cy + br * Math.sin(a)); }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = pct === 50 ? 1.5 : 1;
        ctx.setLineDash(pct === 50 ? [4, 3] : [2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label stacked on the left side of the chart, away from data clutter
        ctx.font = `bold 8px 'DM Sans', sans-serif`;
        ctx.fillStyle = solidColor;
        ctx.textAlign = "right";
        // Position: left of centre, at ring's leftmost point, slightly above centre line
        const labelX = cx - br - 4;
        const labelY = cy - (pct === 75 ? 10 : pct === 50 ? 2 : -8);
        ctx.fillText(label, labelX, labelY);
      });
    }

    // Data polygon
    ctx.beginPath();
    data.forEach((v, i) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      const d = (r * Math.min(v, 100)) / 100;
      if (i === 0) { ctx.moveTo(cx + d * Math.cos(a), cy + d * Math.sin(a)); }
      else { ctx.lineTo(cx + d * Math.cos(a), cy + d * Math.sin(a)); }
    });
    ctx.closePath();
    ctx.fillStyle = `hsla(${primaryHsl}, 0.15)`;
    ctx.fill();
    ctx.strokeStyle = `hsl(${primaryHsl})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Data points
    data.forEach((v, i) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      const d = (r * Math.min(v, 100)) / 100;
      ctx.beginPath();
      ctx.arc(cx + d * Math.cos(a), cy + d * Math.sin(a), 4, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${primaryHsl})`;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Labels
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.fillStyle = "#8A8A8A";
    ctx.textAlign = "center";
    labels.forEach((l, i) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      ctx.fillText(l, cx + (r + 22) * Math.cos(a), cy + (r + 22) * Math.sin(a) + 4);
    });
  }, [data, labels, size, showBenchmark]);

  return <canvas ref={ref} className="block mx-auto" />;
}
