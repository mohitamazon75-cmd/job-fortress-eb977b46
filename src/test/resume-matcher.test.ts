// ═══════════════════════════════════════════════════════════════
// Resume-Matcher port — vitest behavior locks (B2.1)
//
// Each fixture explicitly restates the heuristic it's calibrated
// against, per the BL-036 lesson — no summaries that rot silently.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { matchResumeToJD } from "@/lib/resume-matcher";
import { normalizeText, tokenize, rawSplit, filterTokens, bigrams } from "@/lib/resume-matcher/tokenize";
import { termFrequency, documentFrequency, inverseDocumentFrequency, buildCorpus } from "@/lib/resume-matcher/tfidf";
import { cosineSimilarity, keywordGap } from "@/lib/resume-matcher/cosine-match";
import { isStopword } from "@/lib/resume-matcher/stopwords";

describe("stopwords — frequency vs signal", () => {
  it("treats grammar words as stopwords", () => {
    // CALIBRATED FOR: pure grammar/function tokens with zero domain signal
    expect(isStopword("the")).toBe(true);
    expect(isStopword("and")).toBe(true);
    expect(isStopword("of")).toBe(true);
  });
  it("treats resume-boilerplate noise as stopwords", () => {
    // CALIBRATED FOR: high-frequency resume words that swamp tf-idf otherwise
    expect(isStopword("experience")).toBe(true);
    expect(isStopword("year")).toBe(true);
    expect(isStopword("team")).toBe(true);
    expect(isStopword("work")).toBe(true);
  });
  it("KEEPS skill-adjacent common words as signal", () => {
    // CALIBRATED FOR: domain-meaningful words that look common but discriminate
    expect(isStopword("data")).toBe(false);
    expect(isStopword("design")).toBe(false);
    expect(isStopword("python")).toBe(false);
    expect(isStopword("manager")).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isStopword("THE")).toBe(true);
    expect(isStopword("Experience")).toBe(true);
  });
});

describe("normalizeText — strip noise", () => {
  it("lowercases", () => {
    expect(normalizeText("HELLO World")).toBe("hello world");
  });
  it("strips URLs", () => {
    // CALIBRATED FOR: resume noise — links carry no domain signal
    expect(normalizeText("see https://github.com/me for details"))
      .toBe("see for details");
    expect(normalizeText("portfolio at www.example.com")).toBe("portfolio at");
  });
  it("strips emails and phone numbers", () => {
    expect(normalizeText("contact me@x.com or +91 98765 43210")).toBe("contact or");
  });
  it("collapses whitespace", () => {
    expect(normalizeText("  a   b\n\nc\t\td  ")).toBe("a b c d");
  });
  it("returns empty on falsy input", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null as unknown as string)).toBe("");
    expect(normalizeText(undefined as unknown as string)).toBe("");
  });
});

describe("rawSplit — keep skill-bearing punctuation inside words", () => {
  it("preserves + in C++", () => {
    // CALIBRATED FOR: "C++" must survive tokenization as one token
    expect(rawSplit("c++ developer")).toEqual(["c++", "developer"]);
  });
  it("preserves # in C#", () => {
    expect(rawSplit("c# net")).toEqual(["c#", "net"]);
  });
  it("preserves . in node.js", () => {
    expect(rawSplit("node.js backend")).toEqual(["node.js", "backend"]);
  });
  it("trims trailing dots from sentence ends", () => {
    // CALIBRATED FOR: "node.js." (end of sentence) → "node.js" not "node.js."
    expect(rawSplit("built node.js. then python")).toEqual(["built", "node.js", "then", "python"]);
  });
  it("splits on commas, slashes, parens", () => {
    expect(rawSplit("python, sql/postgres (advanced)")).toEqual(["python", "sql", "postgres", "advanced"]);
  });
});

describe("filterTokens — drop noise, keep signal", () => {
  it("drops pure-number tokens", () => {
    // CALIBRATED FOR: "5" "2024" carry no skill signal
    expect(filterTokens(["python", "5", "2024", "sql"])).toEqual(["python", "sql"]);
  });
  it("drops sub-min-length tokens unless allowlisted", () => {
    // CALIBRATED FOR: "c", "r", "go" are real skills and must survive minLength=2
    expect(filterTokens(["c", "r", "go", "python", "x", "ab"])).toEqual(["c", "r", "go", "python", "ab"]);
  });
  it("drops stopwords", () => {
    expect(filterTokens(["the", "python", "experience", "sql", "team"])).toEqual(["python", "sql"]);
  });
});

describe("bigrams — capture multi-word skills", () => {
  it("generates adjacent pairs", () => {
    // CALIBRATED FOR: "machine learning" must appear as one signal
    expect(bigrams(["machine", "learning", "engineer"])).toEqual([
      "machine learning",
      "learning engineer",
    ]);
  });
  it("returns empty on <2 tokens", () => {
    expect(bigrams([])).toEqual([]);
    expect(bigrams(["solo"])).toEqual([]);
  });
});

describe("tokenize — full pipeline", () => {
  it("emits unigrams + bigrams by default", () => {
    const out = tokenize("Built Python APIs");
    // Built → stopword? no, but it's not in stoplist; all 3 survive minLength
    // Verify both shapes present.
    expect(out).toContain("python");
    expect(out).toContain("apis");
    expect(out.some((t) => t.includes(" "))).toBe(true); // bigram present
  });
  it("can disable bigrams", () => {
    const out = tokenize("python sql golang", { bigrams: false });
    expect(out.every((t) => !t.includes(" "))).toBe(true);
  });
});

describe("tfidf — classical math", () => {
  it("term frequency normalizes by doc length", () => {
    // CALIBRATED FOR: tf("a") in ["a","a","b"] = 2/3
    const tf = termFrequency(["a", "a", "b"]);
    expect(tf.get("a")).toBeCloseTo(2 / 3);
    expect(tf.get("b")).toBeCloseTo(1 / 3);
  });
  it("term frequency on empty stream returns empty map", () => {
    expect(termFrequency([]).size).toBe(0);
  });
  it("document frequency counts containing docs, not occurrences", () => {
    // CALIBRATED FOR: "a" appears 3x in doc1 but df("a")=1, not 3
    const df = documentFrequency([["a", "a", "a", "b"], ["a", "c"], ["b"]]);
    expect(df.get("a")).toBe(2);
    expect(df.get("b")).toBe(2);
    expect(df.get("c")).toBe(1);
  });
  it("inverse document frequency is sklearn-smoothed", () => {
    // CALIBRATED FOR: idf(t) = ln((N+1)/(df+1)) + 1, sklearn default
    // N=2, df=1 → ln(3/2)+1 ≈ 1.4055
    const idf = inverseDocumentFrequency(2, new Map([["foo", 1]]));
    expect(idf.get("foo")).toBeCloseTo(Math.log(3 / 2) + 1);
  });
  it("buildCorpus returns vectors aligned to inputs", () => {
    const { vectors, idf } = buildCorpus([["python"], ["python", "sql"]]);
    expect(vectors).toHaveLength(2);
    expect(idf.size).toBeGreaterThan(0);
  });
});

describe("cosineSimilarity — geometric correctness", () => {
  it("is 1 for identical vectors", () => {
    const v = new Map([["a", 1], ["b", 2]]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });
  it("is 0 for disjoint vectors", () => {
    const a = new Map([["x", 1]]);
    const b = new Map([["y", 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
  it("is 0 when either side is empty", () => {
    expect(cosineSimilarity(new Map(), new Map([["x", 1]]))).toBe(0);
    expect(cosineSimilarity(new Map([["x", 1]]), new Map())).toBe(0);
  });
  it("is symmetric", () => {
    const a = new Map([["x", 1], ["y", 2]]);
    const b = new Map([["x", 3], ["z", 1]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });
  it("is bounded in [0, 1]", () => {
    const a = new Map([["x", 100], ["y", 200]]);
    const b = new Map([["x", 1], ["y", 1]]);
    const s = cosineSimilarity(a, b);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe("keywordGap — missing vs matched lists", () => {
  it("reports JD terms missing from resume", () => {
    const jd = new Map([["python", 0.5], ["kafka", 0.3], ["sql", 0.2]]);
    const resume = new Map([["python", 0.6], ["sql", 0.1]]);
    const gap = keywordGap(jd, resume);
    expect(gap.missing.map((m) => m.term)).toEqual(["kafka"]);
    expect(gap.matched.map((m) => m.term)).toEqual(["python", "sql"]);
  });
  it("sorts missing by weight desc, then term asc — stable", () => {
    // CALIBRATED FOR: ties on weight resolved alphabetically for snapshot stability
    const jd = new Map([["zeta", 0.5], ["alpha", 0.5], ["beta", 0.3]]);
    const resume = new Map<string, number>();
    const gap = keywordGap(jd, resume);
    expect(gap.missing.map((m) => m.term)).toEqual(["alpha", "zeta", "beta"]);
  });
  it("respects topMissing and topMatched limits", () => {
    const jd = new Map(Array.from({ length: 30 }, (_, i) => [`t${i}`, (30 - i) / 30] as [string, number]));
    const resume = new Map<string, number>();
    const gap = keywordGap(jd, resume, { topMissing: 5, topMatched: 5 });
    expect(gap.missing).toHaveLength(5);
  });
});

describe("matchResumeToJD — end-to-end behavior", () => {
  it("scores 0 on empty input without throwing", () => {
    expect(matchResumeToJD("", "anything").score).toBe(0);
    expect(matchResumeToJD("anything", "").score).toBe(0);
    expect(matchResumeToJD(null as unknown as string, "x").score).toBe(0);
  });
  it("scores high when resume mirrors the JD vocabulary", () => {
    // CALIBRATED FOR: identical core skill set → strong match (>=70)
    const jd = "Senior Python engineer to build Kafka pipelines and SQL data marts.";
    const resume = "Built Kafka pipelines and SQL data marts as a Python engineer.";
    const r = matchResumeToJD(jd, resume);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
  it("scores low when resume and JD share no domain terms", () => {
    // CALIBRATED FOR: disjoint skill vocab → near-zero match
    const jd = "Python machine learning engineer with Kafka.";
    const resume = "Childhood education teacher with classroom design skills.";
    const r = matchResumeToJD(jd, resume);
    expect(r.score).toBeLessThan(15);
  });
  it("surfaces missing keywords from JD that resume lacks", () => {
    // CALIBRATED FOR: "kafka" in JD but not resume must appear in missing list
    const jd = "Python engineer experienced with Kafka and Airflow pipelines.";
    const resume = "Python engineer building REST APIs.";
    const r = matchResumeToJD(jd, resume);
    const missingTerms = r.keywords.missing.map((m) => m.term);
    expect(missingTerms).toContain("kafka");
    expect(missingTerms).toContain("airflow");
  });
  it("surfaces matched keywords present in both", () => {
    const jd = "Python engineer with SQL.";
    const resume = "Python engineer using SQL daily.";
    const r = matchResumeToJD(jd, resume);
    const matchedTerms = r.keywords.matched.map((m) => m.term);
    expect(matchedTerms).toContain("python");
    expect(matchedTerms).toContain("sql");
  });
  it("score is symmetric in argument order (cosine is symmetric)", () => {
    const a = "Senior backend engineer Python Postgres Redis";
    const b = "Backend engineer with Python Postgres and Redis";
    const ab = matchResumeToJD(a, b).score;
    const ba = matchResumeToJD(b, a).score;
    expect(ab).toBe(ba);
  });
  it("returns diagnostics counts", () => {
    const r = matchResumeToJD("python sql", "python sql kafka");
    expect(r.diagnostics.resumeTokens).toBeGreaterThan(0);
    expect(r.diagnostics.jdTokens).toBeGreaterThan(0);
  });
  it("preserves C++ / C# / node.js as single tokens through the pipeline", () => {
    // CALIBRATED FOR: B2.1 must not lose skill-bearing punctuation
    const jd = "C++ and C# developer for Node.js services";
    const resume = "Built Node.js services with C++ and C#";
    const r = matchResumeToJD(jd, resume);
    const all = [...r.keywords.matched.map((m) => m.term), ...r.keywords.missing.map((m) => m.term)];
    expect(all).toContain("c++");
    expect(all).toContain("c#");
    expect(all).toContain("node.js");
  });
});
