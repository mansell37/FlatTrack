import { useEffect, useState } from "react";
import { api } from "../api";
import WorkoutView from "../components/WorkoutView";
import type { Energy, Workout, WorkoutType } from "../types";

const DURATIONS: Record<WorkoutType, number[]> = {
  strength: [10, 15, 20, 30],
  cardio: [20, 30, 40, 50, 60, 90],
};

const ENERGIES: { key: Energy; emoji: string; name: string; desc: string }[] = [
  { key: "fresh", emoji: "💪", name: "Fresh", desc: "Full send" },
  { key: "ok", emoji: "🙂", name: "OK", desc: "Steady" },
  { key: "wrecked", emoji: "🥱", name: "Wrecked", desc: "Bad sleep" },
];

export default function Generate({ onToast }: { onToast: (m: string) => void }) {
  const [type, setType] = useState<WorkoutType>("strength");
  const [duration, setDuration] = useState(20);
  const [energy, setEnergy] = useState<Energy>("ok");
  const [format, setFormat] = useState<string | null>(null);
  const [formats, setFormats] = useState<{ key: string; format: string; title: string }[]>([]);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState<"" | "lib" | "ai">("");
  const [garmin, setGarmin] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => setEnergy(s.default_energy)).catch(() => {});
    api.garminStatus().then((s) => setGarmin(s.configured)).catch(() => {});
  }, []);

  useEffect(() => {
    api.templates().then((t) => setFormats(t[type])).catch(() => {});
    // keep the duration valid for the selected type
    if (!DURATIONS[type].includes(duration)) setDuration(DURATIONS[type][type === "strength" ? 2 : 1]);
    setFormat(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // de-dupe formats for the picker
  const formatOptions = Array.from(new Map(formats.map((f) => [f.format, f])).values());

  async function generate(useAi: boolean) {
    setLoading(useAi ? "ai" : "lib");
    setWorkout(null);
    try {
      const wk = await api.generate({ type, duration_min: duration, energy, format, use_ai: useAi });
      setWorkout(wk);
      if (wk.ai_error) onToast("AI was unavailable — gave you a library workout.");
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setLoading("");
    }
  }

  return (
    <div>
      <div className="card">
        <div className="label">Type</div>
        <div className="seg">
          <button className={type === "strength" ? "active" : ""} onClick={() => setType("strength")}>🏋️ Strength</button>
          <button className={type === "cardio" ? "active" : ""} onClick={() => setType("cardio")}>🚲 Bike</button>
        </div>

        <div className="label mt">Time (minutes)</div>
        <div className="chips">
          {DURATIONS[type].map((d) => (
            <div key={d} className={`chip ${duration === d ? "active" : ""}`} onClick={() => setDuration(d)}>
              {d}
            </div>
          ))}
        </div>

        <div className="label mt">Energy / sleep</div>
        <div className="energy">
          {ENERGIES.map((e) => (
            <div key={e.key} className={`opt ${energy === e.key ? "active" : ""}`} onClick={() => setEnergy(e.key)}>
              <div className="emoji">{e.emoji}</div>
              <div className="name">{e.name}</div>
              <div className="desc">{e.desc}</div>
            </div>
          ))}
        </div>

        <div className="label mt">Style <span className="muted" style={{ textTransform: "none" }}>(optional)</span></div>
        <div className="chips">
          <div className={`chip sm ${format === null ? "active" : ""}`} onClick={() => setFormat(null)}>🎲 Surprise me</div>
          {formatOptions.map((f) => (
            <div key={f.format} className={`chip sm ${format === f.format ? "active" : ""}`} onClick={() => setFormat(f.format)}>
              {f.format}
            </div>
          ))}
        </div>

        <div className="btn-row mt">
          <button className="btn primary block lg" disabled={!!loading} onClick={() => generate(false)}>
            {loading === "lib" ? <span className="spinner" /> : "Generate"}
          </button>
          <button className="btn ghost lg" disabled={!!loading} onClick={() => generate(true)} title="Generate with Claude">
            {loading === "ai" ? <span className="spinner" /> : "✨ AI"}
          </button>
        </div>
      </div>

      {workout && (
        <WorkoutView workout={workout} garminConfigured={garmin} onToast={onToast} />
      )}
      {!workout && !loading && (
        <div className="empty">
          <div className="big-emoji">🔥</div>
          <p>Pick your time and energy, then hit Generate.</p>
        </div>
      )}
    </div>
  );
}
