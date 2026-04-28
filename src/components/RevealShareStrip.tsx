/**
 * Minimal sticky share CTA shown on the reveal page.
 *
 * Why this exists: Friendly #1 finished a scan and never shared because we
 * never asked. This component is the explicit ask, with WhatsApp + native
 * share + copy-link options. All three paths emit `share_clicked` (intent)
 * and the WhatsApp / native paths additionally emit `share_completed` when
 * the OS dialog returns successfully.
 *
 * Deliberately minimal — no images, no long copy, no design heroics. The
 * goal is to discover whether *anyone* shares before we invest in a polished
 * share-card flow.
 */
import { useCallback, useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { trackRevealEvent, type RevealEventContext } from "@/lib/reveal-tracking";

interface RevealShareStripProps {
  ctx: RevealEventContext;
  /** First name (when available) so the share message reads more human. */
  firstName?: string | null;
  /** Public reveal URL — defaults to current page. */
  shareUrl?: string;
}

export default function RevealShareStrip({ ctx, firstName, shareUrl }: RevealShareStripProps) {
  const [copied, setCopied] = useState(false);

  const url = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const who = firstName?.trim() ? firstName.trim() : "I";
  const message =
    `${who} just got an AI Career Risk scan from JobBachao. ` +
    `Free 60-second check — see how exposed your role is: ${url}`;

  const fireIntent = useCallback(
    (channel: string) => {
      trackRevealEvent("share_clicked", ctx, { channel });
    },
    [ctx],
  );

  const fireComplete = useCallback(
    (channel: string) => {
      trackRevealEvent("share_completed", ctx, { channel });
    },
    [ctx],
  );

  const handleWhatsApp = () => {
    fireIntent("whatsapp");
    const href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    // No reliable callback for wa.me — assume completion.
    fireComplete("whatsapp");
  };

  const handleNativeShare = async () => {
    fireIntent("native");
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (!nav.share) {
      // Fall back to copy
      handleCopy();
      return;
    }
    try {
      await nav.share({ title: "JobBachao — AI Career Risk", text: message, url });
      fireComplete("native");
    } catch {
      // User cancelled — no completion event
    }
  };

  const handleCopy = () => {
    fireIntent("copy");
    const writer = navigator.clipboard?.writeText;
    if (writer) {
      writer.call(navigator.clipboard, message).then(
        () => {
          setCopied(true);
          fireComplete("copy");
          setTimeout(() => setCopied(false), 1800);
        },
        () => {
          /* no completion if write failed */
        },
      );
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/30 bg-transparent px-1 py-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        Know someone who needs this?
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleWhatsApp}
          aria-label="Share on WhatsApp"
          className="rounded-full bg-[hsl(142_70%_42%)] px-3 py-1.5 text-[12px] font-bold text-white hover:opacity-90 active:scale-95 transition"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label="Share"
          className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1.5 text-[12px] font-semibold text-foreground/80 hover:bg-muted active:scale-95 transition flex items-center gap-1"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy link"
          className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1.5 text-[12px] font-semibold text-foreground/80 hover:bg-muted active:scale-95 transition flex items-center gap-1"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
