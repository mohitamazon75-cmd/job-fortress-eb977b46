import { cn } from "@/lib/utils";

interface SkillChipProps {
  label: string;
  selected: boolean;
  variant: "ai" | "human";
  onClick: () => void;
}

export default function SkillChip({ label, selected, variant, onClick }: SkillChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 min-h-[36px] select-none",
        selected && variant === "ai" &&
          "bg-destructive/10 border-destructive/40 text-destructive",
        selected && variant === "human" &&
          "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400",
        !selected &&
          "bg-muted/50 border-border text-muted-foreground hover:border-border hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          selected && variant === "ai" ? "bg-destructive" : "",
          selected && variant === "human" ? "bg-green-500" : "",
          !selected ? "bg-muted-foreground/40" : ""
        )}
      />
      {label}
    </button>
  );
}
