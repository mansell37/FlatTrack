import { useState } from "react";
import { api } from "../api";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.login(pw);
      onSuccess();
    } catch (e) {
      setErr((e as Error).message || "Wrong password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <form className="login-wrap" onSubmit={submit}>
        <div className="center">
          <div style={{ fontSize: 48 }}>🔥</div>
          <h1 style={{ margin: "8px 0 0" }}>Office Heat</h1>
          <p className="muted">Enter the password to continue</p>
        </div>
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={pw}
          autoFocus
          onChange={(e) => setPw(e.target.value)}
        />
        {err && <div className="center" style={{ color: "var(--red)", fontSize: 14 }}>{err}</div>}
        <button className="btn primary block lg" disabled={busy || !pw}>
          {busy ? <span className="spinner" /> : "Enter"}
        </button>
      </form>
    </div>
  );
}
