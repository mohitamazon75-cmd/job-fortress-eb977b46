import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { analyzeExpressions } from "./utils/emotionEngine";

// ── Constants ─────────────────────────────────────────────────────────────────
const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";
// NOTE: DETECTOR_OPTIONS must NOT be instantiated at module level — face-api.js
// constructs TinyFaceDetectorOptions eagerly and crashes if the lib isn't ready.
// We create it lazily inside the detection loop instead.
const SCAN_DURATION_MS = 4000;
const DETECT_INTERVAL_MS = 800;
const MAX_READINGS = 5;

// Zone → Tailwind-compatible inline style color
const ZONE_COLORS = {
  green:  "#22c55e",
  blue:   "#3b82f6",
  yellow: "#eab308",
  orange: "#f97316",
  red:    "#ef4444",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function mergeExpressions(readings) {
  if (!readings.length) return {};
  const keys = Object.keys(readings[0]);
  const merged = {};
  for (const k of keys) {
    merged[k] = readings.reduce((sum, r) => sum + (r[k] ?? 0), 0) / readings.length;
  }
  return merged;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BetaFaceScanner({ child, onComplete, onCancel }) {
  const videoRef      = useRef(null);
  const streamRef     = useRef(null);
  const intervalRef   = useRef(null);
  const scanTimerRef  = useRef(null);
  const readingsRef   = useRef([]);        // last N expression snapshots
  const scanStartRef  = useRef(null);

  const [phase, setPhase]           = useState("loading");    // loading | positioning | scanning | done | error
  const [errorType, setErrorType]   = useState(null);         // "denied" | "no-camera" | "models" | "unknown"
  const [countdown, setCountdown]   = useState(4);
  const [progress, setProgress]     = useState(0);            // 0–100
  const [liveZone, setLiveZone]     = useState("blue");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  // BUG-06 fix: parental consent gate — camera never starts until parent explicitly agrees
  const [consented, setConsented]   = useState(false);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    clearInterval(intervalRef.current);
    clearTimeout(scanTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Load models — only after parental consent is given (BUG-06 fix) ──────────
  useEffect(() => {
    if (!consented) return; // wait for parent to explicitly consent before activating camera
    let cancelled = false;
    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;
        setModelsLoaded(true);
        startCamera();
      } catch {
        if (!cancelled) {
          setErrorType("models");
          setPhase("error");
        }
      }
    }
    loadModels();
    return () => { cancelled = true; stopAll(); };
  }, [consented]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start camera ─────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("positioning");
      startDetectionLoop();
    } catch (err) {
      const msg = err?.message ?? "";
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
        setErrorType("denied");
      } else if (msg.includes("NotFound") || msg.includes("no camera")) {
        setErrorType("no-camera");
      } else {
        setErrorType("unknown"); // BUG-13 fix: not a permission or hardware issue — use distinct error type
      }
      setPhase("error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detection loop ────────────────────────────────────────────────────────────
  const startDetectionLoop = useCallback(() => {
    // Create options lazily so face-api.js is guaranteed to be loaded
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.65,
    });
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const result = await faceapi
          .detectSingleFace(videoRef.current, detectorOptions)
          .withFaceExpressions();

        if (!result) {
          // Face lost — reset to positioning
          setPhase((prev) => {
            if (prev === "scanning") {
              clearTimeout(scanTimerRef.current);
              scanStartRef.current = null;
              readingsRef.current = [];
              setCountdown(4);
              setProgress(0);
              return "positioning";
            }
            return prev;
          });
          return;
        }

        const expressions = result.expressions;
        readingsRef.current = [...readingsRef.current.slice(-(MAX_READINGS - 1)), expressions];

        // Live zone feedback
        const live = analyzeExpressions(expressions);
        setLiveZone(live.wellnessZone);

        setPhase((prev) => {
          if (prev === "positioning") {
            // Face first detected — start 4-second scan
            scanStartRef.current = Date.now();
            startScanTimer();
            return "scanning";
          }
          return prev;
        });

        // Update countdown + progress while scanning
        if (scanStartRef.current) {
          const elapsed = Date.now() - scanStartRef.current;
          const pct = Math.min(100, (elapsed / SCAN_DURATION_MS) * 100);
          const cdNum = Math.max(1, Math.ceil(4 - (elapsed / 1000)));
          setProgress(pct);
          setCountdown(cdNum);
        }
      } catch {
        // Silently ignore single-frame detection failures
      }
    }, DETECT_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4-second scan timer ───────────────────────────────────────────────────────
  const startScanTimer = useCallback(() => {
    scanTimerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setProgress(100);
      setCountdown(0);

      const merged = mergeExpressions(readingsRef.current);
      const stableResult = analyzeExpressions(merged);

      setPhase("done");
      stopAll();
      onComplete(stableResult);
    }, SCAN_DURATION_MS);
  }, [onComplete, stopAll]);

  // ── Cancel ────────────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    stopAll();
    onCancel();
  }, [stopAll, onCancel]);

  // ── Retry (model error) ───────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setPhase("loading");
    setErrorType(null);
    readingsRef.current = [];
    scanStartRef.current = null;
    // Re-trigger model load
    (async () => {
      try {
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        }
        if (!faceapi.nets.faceExpressionNet.isLoaded) {
          await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        }
        startCamera();
      } catch {
        setErrorType("models");
        setPhase("error");
      }
    })();
  }, [startCamera]);

  const zoneColor = ZONE_COLORS[liveZone] ?? ZONE_COLORS.blue;

  // ── Render helpers ────────────────────────────────────────────────────────────
  // BUG-06 fix: show consent screen before activating camera (DPDPA 2023 compliance)
  if (!consented) return <ConsentScreen childName={child?.child_name} onAccept={() => setConsented(true)} onCancel={onCancel} />;
  if (phase === "loading") return <LoadingScreen />;
  if (phase === "error")   return <ErrorScreen type={errorType} onRetry={handleRetry} onCancel={handleCancel} />;
  if (phase === "done")    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;

  const isScanning   = phase === "scanning";
  const statusText   = isScanning ? "Hold still… almost there! 🌟" : "Position your face in the oval";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10 gap-6">

      {/* Child name */}
      <div className="text-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Checking in</p>
        <h2 className="font-display text-[22px] font-bold text-foreground">{child?.child_name}</h2>
      </div>

      {/* Video container */}
      <div className="relative w-full max-w-[320px]">
        {/* Video */}
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full rounded-2xl object-cover bg-black"
          style={{ transform: "scaleX(-1)", maxHeight: 280, aspectRatio: "4/3" }}
        />

        {/* Oval guide — positioning phase */}
        {phase === "positioning" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="border-2 border-dashed border-white/80 rounded-full"
              style={{ width: 160, height: 200, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }}
            />
          </div>
        )}

        {/* Scanning overlays */}
        {isScanning && (
          <>
            {/* Corner brackets */}
            {[
              "top-2 left-2 border-l-2 border-t-2 rounded-tl-lg",
              "top-2 right-2 border-r-2 border-t-2 rounded-tr-lg",
              "bottom-2 left-2 border-l-2 border-b-2 rounded-bl-lg",
              "bottom-2 right-2 border-r-2 border-b-2 rounded-br-lg",
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute w-6 h-6 ${cls}`}
                style={{ borderColor: zoneColor }}
              />
            ))}

            {/* Animated scan line */}
            <div
              className="absolute left-0 right-0 h-0.5 opacity-70 scan-line-animate"
              style={{
                background: `linear-gradient(90deg, transparent, ${zoneColor}, transparent)`,
                animation: "scanLine 1.2s ease-in-out infinite",
                top: "40%",
              }}
            />

            {/* Countdown circle */}
            <div
              className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center font-display text-xl font-bold text-white shadow-lg"
              style={{ backgroundColor: zoneColor }}
            >
              {countdown}
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-[320px] h-2 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: zoneColor,
          }}
        />
      </div>

      {/* Status text */}
      <p className="text-sm font-medium text-muted-foreground text-center">{statusText}</p>

      {/* Cancel */}
      <button
        onClick={handleCancel}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium px-4 py-2 rounded-lg hover:bg-muted"
      >
        Cancel
      </button>

      {/* Inline scan-line keyframe */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 20%; opacity: 0; }
          10%  { opacity: 0.7; }
          90%  { opacity: 0.7; }
          100% { top: 80%; opacity: 0; }
        }
        .scan-line-animate { position: absolute; }
      `}</style>
    </div>
  );
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-sm font-medium text-muted-foreground">Getting camera ready…</p>
    </div>
  );
}

// BUG-06 fix: parental consent screen shown before camera activates (DPDPA 2023)
function ConsentScreen({ childName, onAccept, onCancel }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 gap-6 text-center">
      <span className="text-5xl">📋</span>
      <div>
        <h2 className="font-display text-[20px] font-bold text-foreground mb-2">Parental Consent Required</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Wellness Check uses your device's camera to analyse <strong>{childName}'s</strong> facial
          expressions for emotional wellbeing indicators. No images or video are stored or transmitted —
          all processing happens on-device in real time.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          By proceeding you confirm that you are the parent or guardian of {childName} and consent
          to this scan in accordance with DPDPA 2023.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-[260px]">
        <button
          onClick={onAccept}
          className="w-full py-3 rounded-2xl text-sm font-semibold gradient-hero text-primary-foreground shadow-glow-primary hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
        >
          I Consent — Start Scan
        </button>
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-2xl text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ErrorScreen({ type, onRetry, onCancel }) {
  const configs = {
    denied: {
      icon:    "📷",
      title:   "Camera Access Needed",
      body:    "Please tap 'Allow' when your browser asks for camera access. Then refresh this page.",
      showRetry: false,
    },
    "no-camera": {
      icon:    "🚫",
      title:   "No Camera Found",
      body:    "No camera was found on this device. Please try on a device with a front-facing camera.",
      showRetry: false,
    },
    models: {
      icon:    "📡",
      title:   "Couldn't Load Face Detection",
      body:    "Please check your internet connection and try again.",
      showRetry: true,
    },
    // BUG-13 fix: dedicated UI for unexpected camera errors
    unknown: {
      icon:    "⚠️",
      title:   "Camera Unavailable",
      body:    "An unexpected error occurred while starting the camera. Please try refreshing the page.",
      showRetry: true,
    },
  };

  const cfg = configs[type] ?? configs.models;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 gap-6 text-center">
      <span className="text-5xl">{cfg.icon}</span>
      <div>
        <h2 className="font-display text-[20px] font-bold text-foreground mb-2">{cfg.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{cfg.body}</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-[260px]">
        {cfg.showRetry && (
          <button
            onClick={onRetry}
            className="w-full py-3 rounded-2xl text-sm font-semibold gradient-hero text-primary-foreground shadow-glow-primary hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
          >
            Try Again
          </button>
        )}
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-2xl text-sm font-semibold border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary transition-all duration-200"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
