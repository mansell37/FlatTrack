import { useEffect, useState } from "react";
import type { Topic } from "../learn";
import { TOPICS } from "../learn";

const FACT_SECONDS = 30;

/**
 * Cycles through facts while mounted: each fact shows for 30s (with a progress
 * bar), then auto-advances. Non-blocking — the workout keeps running underneath.
 */
export default function LearnCard({
  topic,
  facts,
  onStop,
}: {
  topic: Topic;
  facts: string[];
  onStop: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [secs, setSecs] = useState(FACT_SECONDS);

  useEffect(() => {
    setSecs(FACT_SECONDS);
    const tick = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    const advance = setTimeout(() => setIndex((i) => (i + 1) % facts.length), FACT_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(advance);
    };
  }, [index, facts.length]);

  if (!facts.length) return null;
  const t = TOPICS.find((x) => x.key === topic);

  return (
    <div className="learn-card">
      <div className="learn-head">
        <span className="learn-tag">{t ? `${t.emoji} ${t.label}` : "Learn"}</span>
        <span className="learn-count">{index + 1}/{facts.length}</span>
        <button className="btn ghost sm" onClick={() => setIndex((i) => (i + 1) % facts.length)}>
          Next ›
        </button>
        <button className="btn ghost sm" onClick={onStop}>Stop</button>
      </div>
      <div className="learn-fact">{facts[index]}</div>
      <div className="learn-bar">
        <div style={{ width: `${(secs / FACT_SECONDS) * 100}%` }} />
      </div>
    </div>
  );
}
