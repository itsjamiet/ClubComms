import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

// Shown after someone opens the link in their "reset your password" email.
export default function ResetPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (pw.length < 6) return setError("Use at least 6 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-6">
        <h1 className="font-display text-2xl tracking-wide mb-1">Choose a new password</h1>
        <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>Enter a new password for your account.</p>
        <form onSubmit={save} className="space-y-3">
          <input type="password" className="input-dark w-full" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus />
          <input type="password" className="input-dark w-full" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
          <button type="submit" className="btn-accent w-full py-3 rounded-lg" disabled={busy || !pw}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
      </div>
    </div>
  );
}
