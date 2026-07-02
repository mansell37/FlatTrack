import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { applyTheme, getTheme, type Theme } from "./theme";
import Login from "./components/Login";
import Generate from "./pages/Generate";
import Saved from "./pages/Saved";
import History from "./pages/History";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<Theme>(getTheme());

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }

  function showToast(m: string) {
    setToast(m);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 2600);
  }

  async function checkAuth() {
    try {
      const cfg = await api.authConfig();
      if (!cfg.auth_enabled) return setAuthed(true);
      await api.me(); // 401 if not logged in
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }
  useEffect(() => { checkAuth(); }, []);

  if (authed === null) {
    return <div className="app center" style={{ paddingTop: 80 }}><span className="spinner" /></div>;
  }
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">🔥</div>
        <div>
          <h1>FlatTrack</h1>
          <div className="sub">Quick workouts from your kit</div>
        </div>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      <Routes>
        <Route path="/" element={<Generate onToast={showToast} />} />
        <Route path="/saved" element={<Saved onToast={showToast} />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<SettingsPage onToast={showToast} />} />
      </Routes>

      {toast && <div className="toast">{toast}</div>}

      <nav className="tabbar">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="ico">🔥</span>Generate
        </NavLink>
        <NavLink to="/saved" className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="ico">📚</span>Saved
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="ico">📈</span>History
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="ico">⚙️</span>Settings
        </NavLink>
      </nav>
    </div>
  );
}
