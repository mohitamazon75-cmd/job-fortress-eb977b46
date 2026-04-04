import { useEffect, useState } from "react";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  promptText: string;
}

export default function PromptModal({ isOpen, onClose, title, promptText }: PromptModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, width: "100%", maxHeight: "84vh", display: "flex", flexDirection: "column", background: "white", borderRadius: "20px 20px 0 0", border: "1px solid var(--mb-rule)", borderBottom: "none", animation: "mbSlideUp 300ms ease-out" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--mb-rule)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "var(--mb-ink)" }}>{title}</div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", fontSize: 16, color: "var(--mb-ink3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--mb-ink4)", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>
            Copy this prompt and paste it into the JobBachao chat:
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.82, whiteSpace: "pre-wrap" }}>
            {promptText}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--mb-rule)", flexShrink: 0, display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "11px 16px", border: "1px solid var(--mb-rule)", background: "white", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "var(--mb-ink)" }}>
            Close
          </button>
          <button onClick={handleCopy} style={{ flex: 1, padding: 11, background: "var(--mb-navy)", color: "white", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {copied ? "✓ Copied!" : "Copy prompt to clipboard"}
          </button>
        </div>
      </div>

      <style>{`@keyframes mbSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </div>
  );
}
