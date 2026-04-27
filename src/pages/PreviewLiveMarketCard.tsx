import "@/styles/model-b-tokens.css";
import { useSearchParams } from "react-router-dom";
import LiveMarketCard from "@/components/model-b/LiveMarketCard";
import { r1Fixture, r3Fixture, r2ThinFixture, execFixture, errorFixture, tinyFlatPartialFixture } from "@/components/model-b/liveMarketFixtures";

/**
 * Isolated preview route for LiveMarketCard.
 *
 * Usage: /preview/live-market-card?state=r1|r3|thin|exec|error|loading
 *   r1     → strong band (clean Java corpus, full card)
 *   r3     → partial band (Eng-Mgr corpus with disclaimer, table still shown)
 *   thin   → thin band (marketing user / sales-polluted corpus)
 *   tiny   → partial + tiny + flat (table SUPPRESSED — Layer A fix, screenshot scenario)
 *   exec   → executive skip
 */
export default function PreviewLiveMarketCard() {
  const [params] = useSearchParams();
  const state = (params.get("state") || "r1").toLowerCase();

  let role = "Senior Java Developer";
  const city = "Bangalore, India";
  let snapshot = r1Fixture;
  let force: "loading" | "error" | undefined;

  if (state === "r3") {
    role = "Engineering Manager";
    snapshot = r3Fixture;
  } else if (state === "thin") {
    role = "Digital Marketing Manager";
    snapshot = r2ThinFixture;
  } else if (state === "exec") {
    role = "Chief Executive Officer";
    snapshot = execFixture;
  } else if (state === "error") {
    snapshot = errorFixture;
  } else if (state === "loading") {
    force = "loading";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--mb-paper, #f5f1e8)",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--mb-ink3, #6b6b6b)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 14,
          }}
        >
          Preview · LiveMarketCard · state = {state}
        </div>
        <LiveMarketCard
          role={role}
          city={city}
          all_skills={["Java", "Spring Boot", "Microservices", "REST API", "Project Management"]}
          snapshotOverride={force ? undefined : snapshot}
          forceState={force}
          onPrev={() => alert("onPrev")}
          onNext={() => alert("onNext")}
        />
        <div
          style={{
            marginTop: 24,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "var(--mb-ink3, #6b6b6b)",
          }}
        >
          Switch state via query string: <code>?state=r1</code> · <code>?state=r3</code> · <code>?state=thin</code> · <code>?state=exec</code> · <code>?state=error</code> · <code>?state=loading</code>
        </div>
      </div>
    </div>
  );
}
