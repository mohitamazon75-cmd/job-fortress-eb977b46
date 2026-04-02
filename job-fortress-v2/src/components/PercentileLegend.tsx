export function PercentileLegend() {
  return (
    <div className="flex items-center justify-center gap-4 py-2.5 px-4 rounded-xl bg-muted/50 border border-border">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Key:</span>
      {[
        { color: "bg-success", label: "≥70th", desc: "Above average" },
        { color: "bg-warning", label: "40–69th", desc: "Average" },
        { color: "bg-destructive", label: "<40th", desc: "Needs attention" },
      ].map(({ color, label, desc }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
          <span className="text-[10px] font-semibold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">— {desc}</span>
        </div>
      ))}
    </div>
  );
}
