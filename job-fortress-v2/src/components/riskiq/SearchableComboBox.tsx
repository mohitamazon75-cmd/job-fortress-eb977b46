import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  highlighted?: boolean;
  allowCustom?: boolean;
}

export default function SearchableComboBox({ label, value, onChange, options, placeholder, highlighted, allowCustom = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleSelect = useCallback((v: string) => {
    onChange(v);
    setSearch("");
    setOpen(false);
  }, [onChange]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full h-12 rounded-lg border px-3 text-sm text-left flex items-center justify-between outline-none transition-all ${
          open ? "border-primary ring-2 ring-primary/20" :
          highlighted ? "border-prophet-green bg-prophet-green/5 ring-1 ring-prophet-green/20" :
          "border-border bg-background hover:border-primary/30"
        }`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground/50"}>{value || placeholder}</span>
        <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
          >
            {/* Search input */}
            <div className="p-2 border-b border-border">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
                onKeyDown={e => {
                  if (e.key === "Escape") { setOpen(false); setSearch(""); }
                  if (e.key === "Enter" && filtered.length === 1) handleSelect(filtered[0]);
                  if (e.key === "Enter" && filtered.length === 0 && allowCustom && search.trim()) {
                    handleSelect(search.trim());
                  }
                }}
              />
            </div>

            {/* Options list */}
            <div className="max-h-52 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                allowCustom && search.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleSelect(search.trim())}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left text-primary hover:bg-muted transition-colors"
                  >
                    Use "<span className="font-semibold">{search.trim()}</span>"
                  </button>
                ) : (
                  <div className="py-4 text-center text-xs text-muted-foreground">No matches found</div>
                )
              ) : (
                filtered.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                      value === opt
                        ? "bg-primary/8 text-primary font-semibold"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      value === opt ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {value === opt && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    {opt}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
