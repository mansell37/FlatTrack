import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BENCHMARKS, buildBellRinger, buildFtp20Test, buildRampTest, type Benchmark } from "../challenges";
import { CLIMBS, climbAvgGrade, climbElevationM, climbLengthM, type Climb } from "../climbs";
import ClimbRunner from "../components/ClimbRunner";
import Timer from "../components/Timer";
import type { ChallengeResult, Workout } from "../types";

function fmtScore(r: ChallengeResult): string {
  if (r.unit === "s") {
    const s = Math.round(r.score);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      : `${m}:${sec.toString().padStart(2, "0")}`;
  }
  return r.unit === "W" ? `${Math.round(r.score)}W` : `${Math.round(r.score)} rounds`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Tiny trend line of scores over time (chronological, autoscaled). */
function Sparkline({ results }: { results: ChallengeResult[] }) {
  if (results.length < 2) return null;
  const vals = [...results].reverse().map((r) => r.score); // oldest → newest
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 120, H = 30;
  const pts = vals
    .map((v, i) => `${(i / (vals.length - 1)) * W},${H - 4 - ((v - min) / range) * (H - 8)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sparkline" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ResultLine({ results, lowerIsBetter }: { results: ChallengeResult[]; lowerIsBetter: boolean }) {
  if (!results.length) return <div className="ch-results muted">Not attempted yet</div>;
  const best = results.reduce((a, b) =>
    lowerIsBetter ? (b.score < a.score ? b : a) : (b.score > a.score ? b : a));
  const last = results[0]; // API returns newest first
  return (
    <div className="ch-results">
      <span className="ch-best">🏆 {fmtScore(best)}</span>
      <span className="muted"> · last {fmtScore(last)} ({fmtDate(last.completed_at)}) · {results.length}×</span>
      <Sparkline results={results} />
    </div>
  );
}

export default function Challenges({ onToast }: { onToast: (m: string) => void }) {
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [ftp, setFtp] = useState(200);
  const [weight, setWeight] = useState(70);
  const [active, setActive] = useState<
    | { mode: "bench"; bench: Benchmark; workout: Workout }
    | { mode: "climb"; climb: Climb }
    | null
  >(null);

  function refresh() {
    api.challengeResults().then(setResults).catch(() => {});
  }
  useEffect(() => {
    refresh();
    api.getSettings().then((s) => { setFtp(s.ftp); setWeight(s.weight_kg); }).catch(() => {});
  }, []);

  const byKey = useMemo(() => {
    const m: Record<string, ChallengeResult[]> = {};
    for (const r of results) (m[r.challenge_key] ??= []).push(r);
    return m;
  }, [results]);

  function startBench(b: Benchmark) {
    const workout =
      b.kind === "ramp" ? buildRampTest(ftp)
      : b.kind === "ftp20" ? buildFtp20Test(ftp)
      : buildBellRinger();
    setActive({ mode: "bench", bench: b, workout });
  }

  async function logBenchSession(workout: Workout, elapsedSec: number, difficulty?: string | null) {
    try {
      await api.logSession({ workout, duration_actual_sec: elapsedSec, difficulty: difficulty ?? null });
    } catch {
      /* result itself is already saved; session log is best-effort */
    }
    setActive(null);
    refresh();
    // FTP may have been updated by the test — reload it for the next attempt.
    api.getSettings().then((s) => { setFtp(s.ftp); setWeight(s.weight_kg); }).catch(() => {});
    onToast("Challenge saved 🏆");
  }

  return (
    <div>
      <div className="card">
        <div className="label">Benchmarks</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Repeat these every 4–6 weeks and watch the trend.
        </div>
        {BENCHMARKS.map((b) => (
          <div key={b.key} className="ch-card">
            <div className="ch-emoji">{b.emoji}</div>
            <div className="ch-main">
              <div className="b-label">{b.title}</div>
              <div className="b-notes">{b.blurb}</div>
              <ResultLine results={byKey[b.key] ?? []} lowerIsBetter={false} />
            </div>
            <button className="btn primary ch-start" onClick={() => startBench(b)}>Start</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="label">Landmark climbs</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Ride the real gradients — your live power sets your pace up the mountain.
          Times count as PBs, so pick your day. Profiles are close approximations.
        </div>
        {CLIMBS.map((c) => (
          <div key={c.key} className="ch-card">
            <div className="ch-emoji">{c.flag}</div>
            <div className="ch-main">
              <div className="b-label">{c.name}</div>
              <div className="b-notes">
                {(climbLengthM(c) / 1000).toFixed(1)}km · {climbAvgGrade(c)}% · {climbElevationM(c)}m — {c.blurb}
              </div>
              <ResultLine results={byKey[c.key] ?? []} lowerIsBetter={true} />
            </div>
            <button className="btn primary ch-start" onClick={() => setActive({ mode: "climb", climb: c })}>
              Ride
            </button>
          </div>
        ))}
      </div>

      {active?.mode === "bench" && (
        <Timer
          workout={active.workout}
          challenge={{ kind: active.bench.kind, key: active.bench.key }}
          onClose={() => setActive(null)}
          onLog={(elapsed, _rating, difficulty) => logBenchSession(active.workout, elapsed, difficulty)}
        />
      )}
      {active?.mode === "climb" && (
        <ClimbRunner
          climb={active.climb}
          defaultWeight={weight}
          onClose={() => { setActive(null); refresh(); }}
          onSaved={() => { refresh(); onToast("Climb time saved ⛰️"); }}
        />
      )}
    </div>
  );
}
