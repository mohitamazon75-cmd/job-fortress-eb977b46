import { useEffect, useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  promptText: string;
}

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-action-content`;

export default function PromptModal({ isOpen, onClose, title, promptText }: PromptModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Auto-generate on open
  useEffect(() => {
    if (isOpen && !generated && !loading) {
      generateContent();
    }
    return () => {
      if (!isOpen) {
        setContent("");
        setError("");
        setGenerated(false);
      }
    };
  }, [isOpen]);

  const generateContent = useCallback(async () => {
    if (!promptText?.trim()) {
      setError("No prompt available. Please try a different action.");
      setGenerated(true);
      return;
    }
    setLoading(true);
    setError("");
    setContent("");
    setGenerated(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(STREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: promptText, title }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
              if (bodyRef.current) {
                bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch {}
        }
      }

      // Guard: if stream completed but no content was extracted, fall back to
      // a single non-streaming request before surfacing an error to the user.
      // OpenRouter occasionally returns a 200 stream that contains only the
      // ": OPENROUTER PROCESSING" keepalive and no data: events.
      if (!accumulated.trim()) {
        try {
          const fbResp = await fetch(STREAM_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ prompt: promptText, title, stream: false }),
          });
          if (fbResp.ok) {
            const data = await fbResp.json();
            const fbContent = (data?.content as string | undefined)?.trim() || "";
            if (fbContent) {
              setContent(fbContent);
            } else {
              setError("AI returned an empty response. Please try again.");
            }
          } else {
            const errData = await fbResp.json().catch(() => ({ error: "" }));
            setError(errData.error || "AI returned an empty response. Please try again.");
          }
        } catch {
          setError("AI returned an empty response. Please try again.");
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Failed to generate content");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [promptText, title]);

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "white", borderRadius: "20px 20px 0 0", border: "1px solid var(--mb-rule)", borderBottom: "none", animation: "mbSlideUp 300ms ease-out", boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--mb-rule)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "var(--mb-ink)" }}>{title}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--mb-green)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                {loading ? (
                  <>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mb-green)", animation: "mbPulse 1.5s infinite" }} />
                    AI is writing...
                  </>
                ) : content ? (
                  "✓ Generated for you"
                ) : null}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", fontSize: 16, color: "var(--mb-ink3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >×</button>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div style={{ background: "var(--mb-red-tint)", border: "1.5px solid rgba(174,40,40,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-red)", margin: 0 }}>{error}</p>
              <button
                onClick={generateContent}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, marginTop: 10, padding: "8px 16px", borderRadius: 8, background: "var(--mb-red)", color: "white", border: "none", cursor: "pointer" }}
              >Try again</button>
            </div>
          )}

          {!content && loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--mb-rule)", borderTopColor: "var(--mb-navy)", animation: "mbSpin 0.8s linear infinite" }} />
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink2)" }}>Generating personalised content...</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)" }}>This takes 5–10 seconds</div>
            </div>
          )}

          {content && (
            <div className="mb-generated-content" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.85 }}>
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 12, marginTop: 20 }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "var(--mb-navy)", marginBottom: 10, marginTop: 18 }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8, marginTop: 16 }}>{children}</h3>,
                  p: ({ children }) => <p style={{ marginBottom: 12, lineHeight: 1.85 }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: "italic", color: "var(--mb-ink2)" }}>{children}</em>,
                  ul: ({ children }) => <ul style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: 6, lineHeight: 1.75 }}>{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote style={{ borderLeft: "3px solid var(--mb-navy)", paddingLeft: 16, margin: "12px 0", color: "var(--mb-navy)", fontStyle: "italic" }}>{children}</blockquote>
                  ),
                  code: ({ children }) => (
                    <code style={{ background: "var(--mb-paper)", padding: "2px 6px", borderRadius: 4, fontSize: 13, fontFamily: "'DM Mono', monospace", color: "var(--mb-navy)" }}>{children}</code>
                  ),
                  hr: () => <hr style={{ border: "none", borderTop: "1.5px solid var(--mb-rule)", margin: "16px 0" }} />,
                }}
              >
                {content}
              </ReactMarkdown>
              {loading && (
                <span style={{ display: "inline-block", width: 8, height: 18, background: "var(--mb-navy)", marginLeft: 2, animation: "mbBlink 0.8s infinite", borderRadius: 1, verticalAlign: "text-bottom" }} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--mb-rule)", flexShrink: 0, display: "flex", gap: 8 }}>
          <button onClick={handleClose} style={{ padding: "11px 16px", border: "1px solid var(--mb-rule)", background: "white", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "var(--mb-ink)", minHeight: 44 }}>
            Close
          </button>
          {content && !loading && (
            <button
              onClick={() => { setGenerated(false); generateContent(); }}
              style={{ padding: "11px 16px", border: "1.5px solid var(--mb-navy-tint2)", background: "var(--mb-navy-tint)", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--mb-navy)", minHeight: 44 }}
            >
              ↻ Regenerate
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!content || loading}
            style={{ flex: 1, padding: 11, background: content && !loading ? "var(--mb-navy)" : "var(--mb-rule)", color: content && !loading ? "white" : "var(--mb-ink3)", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: content && !loading ? "pointer" : "not-allowed", minHeight: 44, transition: "all 150ms" }}
          >
            {copied ? "✓ Copied!" : "Copy to clipboard"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes mbSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes mbSpin { to { transform: rotate(360deg) } }
        @keyframes mbBlink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes mbPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </div>
  );
}
