import { useState } from "react";
import { Shield } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { LegalLinks } from "../components/AccountSettings.jsx";

export default function ClubAuth() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    setLoading(false);
    if (error) setError(error.message);
    else setNotice("If that email has an account, a reset link is on its way. Check your inbox (and spam).");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "club", display_name: displayName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is required, there's no active session yet --
    // the club row gets created the first time they log in instead (see App.jsx).
    if (!data.session) {
      setNotice("Check your email to confirm your account, then log in.");
      setLoading(false);
      return;
    }

    // Confirmation not required -- session is active immediately, so create
    // the club now via the server-side function (the database decides who
    // "you" are from your session, rather than trusting a value the app sends).
    const { error: clubError } = await supabase.rpc("create_my_club", { club_name: clubName });

    if (clubError) {
      setError(clubError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "2px solid var(--accent)" }}>
            <Shield className="w-7 h-7" style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-wide text-center">
            Club <span style={{ color: "var(--accent)" }}>Sign In</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Manage your club's teams, calendar, and documents.
          </p>
        </div>

        <div className="glass-panel p-6">
          <div className="flex gap-2 mb-5">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "login" ? "btn-accent" : "btn-ghost"}`}
              onClick={() => { setMode("login"); setError(""); setNotice(""); }}
            >
              Log in
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "signup" ? "btn-accent" : "btn-ghost"}`}
              onClick={() => { setMode("signup"); setError(""); setNotice(""); }}
            >
              Create club
            </button>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : mode === "forgot" ? handleForgot : handleSignup} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Club name</label>
                  <input className="input-dark w-full mt-1" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="e.g. Westland Sports FC" required />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Your name</label>
                  <input className="input-dark w-full mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" required />
                </div>
              </>
            )}
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Email</label>
              <input type="email" className="input-dark w-full mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Password</label>
              <input type="password" className="input-dark w-full mt-1" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            )}

            {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
            {notice && <p className="text-sm" style={{ color: "var(--gold-light)" }}>{notice}</p>}

            <button type="submit" className="btn-accent w-full py-3 rounded-lg mt-2" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Log in" : mode === "forgot" ? "Send reset link" : "Create club"}
            </button>
          </form>
          {mode === "login" && (
            <button type="button" className="text-sm mt-4 underline" style={{ color: "var(--muted)" }} onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>
              Forgot password?
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" className="text-sm mt-4 underline" style={{ color: "var(--muted)" }} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>
              Back to log in
            </button>
          )}
        </div>
        <div className="mt-5 flex justify-center"><LegalLinks /></div>
      </div>
    </div>
  );
}
