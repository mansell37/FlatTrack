import { useEffect, useState } from "react";
import { api } from "../api";
import WorkoutView from "../components/WorkoutView";
import type { SavedWorkout, WorkoutType } from "../types";

export default function Saved({ onToast }: { onToast: (m: string) => void }) {
  const [items, setItems] = useState<SavedWorkout[]>([]);
  const [filter, setFilter] = useState<"all" | WorkoutType>("all");
  const [open, setOpen] = useState<SavedWorkout | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.listWorkouts(filter === "all" ? undefined : { type: filter }));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function toggleFav(w: SavedWorkout, e: React.MouseEvent) {
    e.stopPropagation();
    await api.rateWorkout(w.id, { favorite: !w.favorite });
    load();
  }
  async function rate(w: SavedWorkout, rating: "like" | "dislike", e: React.MouseEvent) {
    e.stopPropagation();
    await api.rateWorkout(w.id, { rating: w.rating === rating ? null : rating });
    load();
  }
  async function del(w: SavedWorkout, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${w.title}"?`)) return;
    await api.deleteWorkout(w.id);
    onToast("Deleted");
    load();
  }

  if (open) {
    return (
      <div>
        <button className="btn ghost mt" onClick={() => { setOpen(null); load(); }}>‹ Back to saved</button>
        <WorkoutView workout={open.structure} savedId={open.id} onToast={onToast} />
      </div>
    );
  }

  return (
    <div>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
        <button className={filter === "strength" ? "active" : ""} onClick={() => setFilter("strength")}>🏋️ Strength</button>
        <button className={filter === "cardio" ? "active" : ""} onClick={() => setFilter("cardio")}>🚲 Bike</button>
      </div>

      {loading && <div className="empty"><span className="spinner" /></div>}
      {!loading && items.length === 0 && (
        <div className="empty">
          <div className="big-emoji">📭</div>
          <p>No saved workouts yet. Generate one and tap Save.</p>
        </div>
      )}

      {items.map((w) => (
        <div key={w.id} className="card" style={{ padding: 0 }}>
          <div className="list-item" onClick={() => setOpen(w)}>
            <div className="num" style={{ fontSize: 18 }}>{w.type === "strength" ? "🏋️" : "🚲"}</div>
            <div className="b-main">
              <div className="b-label">{w.favorite ? "⭐ " : ""}{w.title}</div>
              <div className="b-notes">
                {w.format} · {w.duration_min} min · {w.energy}
                {w.times_done ? ` · done ${w.times_done}×` : ""}
              </div>
            </div>
            <button className={`icon-btn ${w.rating === "like" ? "on-like" : ""}`} onClick={(e) => rate(w, "like", e)}>👍</button>
            <button className={`icon-btn ${w.rating === "dislike" ? "on-dislike" : ""}`} onClick={(e) => rate(w, "dislike", e)}>👎</button>
            <button className={`icon-btn ${w.favorite ? "on-fav" : ""}`} onClick={(e) => toggleFav(w, e)}>{w.favorite ? "★" : "☆"}</button>
            <button className="icon-btn" onClick={(e) => del(w, e)}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}
