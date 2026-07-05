import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { Climb } from "../climbs";
import { climbAvgGrade, climbElevationM, climbLengthM, gradeAt, speedFromPower } from "../climbs";
import { finish as finishSound, go, initAudio, vibrate } from "../sound";
import { useTrainer } from "../useTrainer";

function fmtTime(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`
    : `${m}:${r.toString().padStart(2, "0")}`;
}

function gradeColor(g: number): string {
  if (g < 4) return "var(--grade-1)";
  if (g < 7) return "var(--grade-2)";
  if (g < 10) return "var(--grade-3)";
  return "var(--grade-4)";
}

/** TV-style elevation profile: gradient-coloured silhouette + rider dot. */
function ClimbProfile({ climb, distanceM }: { climb: Climb; distanceM: number }) {
  const W = 1000;
  const H = 240;
  const geom = useMemo(() => {
    const totalM = climbLengthM(climb);
    const totalElev = climbElevationM(climb);
    // Cumulative (x, elev) points per segment boundary.
    let d = 0, e = 0;
    const pts = [{ d: 0, e: 0, g: climb.segments[0]?.g ?? 0 }];
    for (const s of climb.segments) {
      d += s.km * 1000;
      e += s.km * 1000 * (s.g / 100);
      pts.push({ d, e, g: s.g });
    }
    const x = (dist: number) => (dist / totalM) * W;
    const y = (elev: number) => H - 14 - (elev / totalElev) * (H - 40);
    return { totalM, totalElev, pts, x, y };
  }, [climb]);

  const { totalM, pts, x, y } = geom;
  const dist = Math.min(distanceM, totalM);
  // Rider elevation by interpolating between boundary points.
  let riderElev = 0;
  for (let i = 1; i < pts.length; i++) {
    if (dist <= pts[i].d) {
      const f = (dist - pts[i - 1].d) / (pts[i].d - pts[i - 1].d);
      riderElev = pts[i - 1].e + f * (pts[i].e - pts[i - 1].e);
      break;
    }
    riderElev = pts[i].e;
  }

  return (
    <div className="climb-profile">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="climb-svg">
        {/* one filled polygon per segment, coloured by gradient */}
        {pts.slice(1).map((p, i) => {
          const a = pts[i];
          return (
            <polygon
              key={i}
              points={`${x(a.d)},${H} ${x(a.d)},${y(a.e)} ${x(p.d)},${y(p.e)} ${x(p.d)},${H}`}
              fill={gradeColor(p.g)}
              opacity={p.d <= dist ? 1 : 0.42}
            />
          );
        })}
        {/* summit flag */}
        <text x={W - 8} y={y(pts[pts.length - 1].e) - 8} textAnchor="end" className="climb-summit">🏁</text>
        {/* rider */}
        <line x1={x(dist)} x2={x(dist)} y1={y(riderElev)} y2={H} className="climb-rider-line" />
        <circle cx={x(dist)} cy={y(riderElev)} r={7} className="climb-rider-dot" />
      </svg>
      <div className="climb-scale">
        <span>0km</span>
        <span>{(totalM / 2000).toFixed(1)}km</span>
        <span>{(totalM / 1000).toFixed(1)}km</span>
      </div>
    </div>
  );
}

export default function ClimbRunner({
  climb,
  defaultWeight,
  onClose,
  onSaved,
}: {
  climb: Climb;
  defaultWeight: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const trainer = useTrainer();
  const totalM = useMemo(() => climbLengthM(climb), [climb]);
  const totalElev = useMemo(() => climbElevationM(climb), [climb]);

  const [weight, setWeight] = useState(defaultWeight || 70);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Live state (updated once per second).
  const [dist, setDist] = useState(0);
  const [elev, setElev] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(0);

  const distRef = useRef(0);
  const elevRef = useRef(0);
  const elapsedRef = useRef(0);
  const runningRef = useRef(true);
  const weightRef = useRef(weight);
  const powerSum = useRef(0);
  const powerN = useRef(0);
  const elevHist = useRef<number[]>([]); // last 60 elevation values, for VAM
  const dataRef = useRef(trainer.data);
  runningRef.current = running;
  weightRef.current = weight;
  dataRef.current = trainer.data;

  function start() {
    initAudio();
    go();
    vibrate(60);
    setStarted(true);
    // Persist the weight so it's remembered next time.
    api.updateSettings({ weight_kg: Math.round(weight) }).catch(() => {});
  }

  useEffect(() => {
    if (!started || done) return;
    const id = setInterval(() => {
      if (!runningRef.current) return;
      const p = dataRef.current.power ?? 0;
      const g = gradeAt(climb, distRef.current);
      const v = speedFromPower(p, g, weightRef.current);
      distRef.current += v;
      elevRef.current += v * (g / 100);
      elapsedRef.current += 1;
      if (p > 0) { powerSum.current += p; powerN.current += 1; }
      elevHist.current.push(elevRef.current);
      if (elevHist.current.length > 60) elevHist.current.shift();

      setDist(distRef.current);
      setElev(elevRef.current);
      setElapsed(elapsedRef.current);
      setSpeed(v);

      if (distRef.current >= totalM) {
        setDone(true);
        setRunning(false);
        finishSound();
        vibrate([80, 60, 80, 60, 160]);
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, climb, totalM]);

  const avgPower = powerN.current ? Math.round(powerSum.current / powerN.current) : 0;
  const grade = gradeAt(climb, dist);
  const vam = elevHist.current.length > 10
    ? Math.round(((elevHist.current[elevHist.current.length - 1] - elevHist.current[0]) /
        (elevHist.current.length - 1)) * 3600)
    : 0;
  const toGo = Math.max(0, totalM - dist);
  const eta = speed > 0.3 ? toGo / speed : null;

  async function saveResult() {
    setSaving(true);
    try {
      await api.saveChallengeResult({
        challenge_key: climb.key,
        score: elapsedRef.current,
        unit: "s",
        details: { avg_power: avgPower || undefined, weight_kg: Math.round(weight), vam_avg: elapsed > 0 ? Math.round((totalElev / elapsed) * 3600) : undefined },
      });
      await api.logSession({
        workout: {
          type: "cardio", title: `${climb.name} (virtual climb)`, format: "CLIMB",
          duration_min: Math.round(elapsedRef.current / 60), energy: "fresh",
          source: "template", timer: "interval", blocks: [],
        },
        duration_actual_sec: elapsedRef.current,
      });
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  // ---- Summit screen ----
  if (done) {
    return (
      <div className="timer-overlay done-screen">
        <div className="done-hero">
          <div className="emoji">⛰️</div>
          <div className="title">{climb.name} — summited!</div>
          <div className="sub">{climb.flag} {climb.where}</div>
        </div>
        <div className="challenge-result">
          <div className="cr-big">{fmtTime(elapsed)}</div>
          <div className="muted">Your time · {totalElev}m of climbing</div>
        </div>
        <div className="ride-metrics">
          <div className="rm-tile"><div className="rm-val">{avgPower || "–"}</div><div className="rm-lbl">Avg · W</div></div>
          <div className="rm-tile accent">
            <div className="rm-val">{elapsed > 0 ? Math.round((totalElev / elapsed) * 3600) : "–"}</div>
            <div className="rm-lbl">VAM · m/h</div>
          </div>
          <div className="rm-tile">
            <div className="rm-val">{avgPower ? (avgPower / weight).toFixed(1) : "–"}</div>
            <div className="rm-lbl">W/kg</div>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn primary block" disabled={saving || saved} onClick={saveResult}>
            {saving ? <span className="spinner" /> : saved ? "✅ Saved" : "Save time"}
          </button>
          <button className="btn ghost" onClick={onClose}>{saved ? "Close" : "Discard"}</button>
        </div>
      </div>
    );
  }

  // ---- Ready screen ----
  if (!started) {
    return (
      <div className="timer-overlay ride">
        <div className="timer-phase">{climb.flag} Virtual climb · Ready</div>
        <div className="timer-current">
          <div className="lbl">{climb.name}</div>
          <div className="notes">
            {(totalM / 1000).toFixed(1)}km · {climbAvgGrade(climb)}% avg · {totalElev}m of climbing — {climb.blurb}
          </div>
        </div>

        <ClimbProfile climb={climb} distanceM={0} />

        <div className="trainer-panel">
          <div className="trainer-status">
            {trainer.status === "connected" ? (
              <>
                <span className="ts-state"><span className="ts-dot on" /> Trainer connected — your power sets your pace</span>
                <button className="btn ghost sm" onClick={() => trainer.disconnect()}>Disconnect</button>
              </>
            ) : trainer.status === "unsupported" ? (
              <span className="muted" style={{ fontSize: 12 }}>
                Climbs need live power — use Chrome or Edge on a computer or Android.
              </span>
            ) : (
              <button className="btn connect" onClick={() => trainer.connect()} disabled={trainer.status === "connecting"}>
                {trainer.status === "connecting" ? <span className="spinner" /> : <><span className="ts-dot" /> 🔌 Connect trainer</>}
              </button>
            )}
          </div>
          {trainer.status === "error" && trainer.error && (
            <div className="center" style={{ fontSize: 12, color: "var(--accent)" }}>{trainer.error}</div>
          )}
          <div className="weight-row">
            <span className="label" style={{ margin: 0 }}>Rider weight</span>
            <button className="btn ghost ftp-step" onClick={() => setWeight((w) => Math.max(30, w - 1))}>−</button>
            <input
              className="input ftp-input weight-input"
              type="number"
              inputMode="numeric"
              value={weight}
              onChange={(e) => setWeight(Math.min(200, Math.max(30, parseInt(e.target.value || "0", 10) || 70)))}
            />
            <button className="btn ghost ftp-step" onClick={() => setWeight((w) => Math.min(200, w + 1))}>+</button>
            <span className="muted" style={{ fontSize: 12 }}>kg (+9kg bike)</span>
          </div>
        </div>

        <div className="flex-spacer" />
        <button
          className="btn primary block lg"
          onClick={start}
          disabled={trainer.status !== "connected"}
          title={trainer.status !== "connected" ? "Connect your trainer first — the climb runs off your live power" : undefined}
        >
          {trainer.status === "connected" ? "▶ Start climb" : "Connect trainer to start"}
        </button>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn ghost block" onClick={onClose}>Back</button>
        </div>
      </div>
    );
  }

  // ---- Live climb ----
  return (
    <div className="timer-overlay ride">
      <div className="timer-phase">{climb.flag} {climb.name}</div>

      <div className="ride-dash">
        <div className="rd-tile big work">
          <div className="rd-val">{(dist / 1000).toFixed(2)}<span className="rd-unit">km</span></div>
          <div className="rd-lbl">of {(totalM / 1000).toFixed(1)}km · {fmtTime(elapsed)} elapsed</div>
        </div>
        <div className="rd-tile big accent">
          <div className="rd-val">{trainer.data.power ?? "–"}</div>
          <div className="rd-lbl">Power · W</div>
        </div>
        <div className="rd-tile" style={{ borderColor: gradeColor(grade) }}>
          <div className="rd-val">{grade.toFixed(1)}%</div>
          <div className="rd-lbl">Gradient</div>
        </div>
        <div className="rd-tile">
          <div className="rd-val">{(speed * 3.6).toFixed(1)}</div>
          <div className="rd-lbl">Speed · km/h</div>
        </div>
        <div className="rd-tile">
          <div className="rd-val">{vam || "–"}</div>
          <div className="rd-lbl">VAM · m/h</div>
        </div>
        <div className="rd-tile">
          <div className="rd-val">{trainer.data.cadence != null ? Math.round(trainer.data.cadence) : "–"}</div>
          <div className="rd-lbl">Cadence</div>
        </div>
        <div className="rd-tile">
          <div className="rd-val">{avgPower || "–"}</div>
          <div className="rd-lbl">Avg power</div>
        </div>
        <div className="rd-tile">
          <div className="rd-val">{Math.round(elev)}</div>
          <div className="rd-lbl">Climbed · of {totalElev}m</div>
        </div>
        <div className="rd-tile">
          <div className="rd-val">{eta != null ? fmtTime(eta) : "–"}</div>
          <div className="rd-lbl">Summit ETA</div>
        </div>
        <div className="rd-tile">
          <div className="rd-val">{((dist / totalM) * 100).toFixed(0)}%</div>
          <div className="rd-lbl">Done</div>
        </div>
      </div>

      <ClimbProfile climb={climb} distanceM={dist} />

      {trainer.status !== "connected" && (
        <div className="center" style={{ color: "var(--accent)", fontSize: 13, marginBottom: 8 }}>
          Trainer disconnected — you're freewheeling! Reconnect to keep climbing.
        </div>
      )}

      <div className="timer-controls">
        <button className="btn primary" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Resume"}
        </button>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn ghost block" onClick={onClose}>Quit climb</button>
      </div>
    </div>
  );
}
