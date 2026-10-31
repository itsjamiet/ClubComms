import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { LegalLinks } from "../components/AccountSettings.jsx";

export default function AcceptInvite({ inviteId, session, onDone }) {
  const [info, setInfo] = useState(null); // { team_name, role, used }
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    supabase.rpc("get_invite_info", { p_invite_id: inviteId }).then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        setLoadError("This invite link isn't valid, or it's expired.");
        return;
      }
      setInfo(data[0]);
    });
  }, [inviteId]);

  // If the person is already logged in (e.g. a coach with a second team
  // invite), redeem it immediately -- no signup form needed.
  useEffect(() => {
    if (session && info && !info.used && !redeemed) {
      setLoading(true);
      supabase.rpc("redeem_invite", { p_invite_id: inviteId }).then(({ error }) => {
        setLoading(false);
        if (error) setError(error.message);
        else setRedeemed(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, info]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: info.role, display_name: name } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNotice("Check your email to confirm your account, then open this same invite link again to finish joining.");
      setLoading(false);
      return;
    }

    const { error: redeemError } = await supabase.rpc("redeem_invite", { p_invite_id: inviteId });
    setLoading(false);
    if (redeemError) {
      setError(redeemError.message);
      return;
    }
    setRedeemed(true);
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-6 max-w-sm text-center">
          <p style={{ color: "var(--muted)" }}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted)" }}>Loading invite…</p>
      </div>
    );
  }

  const displayName = info.role === "club" ? info.club_name : info.team_name;

  if (info.used && !redeemed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-6 max-w-sm text-center">
          <p style={{ color: "var(--muted)" }}>This invite has already been used. Ask for a fresh link if you still need access.</p>
        </div>
      </div>
    );
  }

  if (redeemed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-6 max-w-sm text-center">
          <h1 className="font-display text-xl tracking-wide mb-2">You're in ✅</h1>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            You've joined <span style={{ color: "var(--white)" }}>{displayName}</span> as {info.role}
            {info.role === "parent" && info.player_name ? (
              <> of <span style={{ color: "var(--white)" }}>{info.player_name}</span></>
            ) : null}
            .
          </p>
          <button className="btn-accent w-full py-3 rounded-lg" onClick={onDone}>Continue</button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted)" }}>{loading ? "Joining…" : error || "One moment…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "2px solid var(--accent)" }}>
            <Shield className="w-7 h-7" style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-center">
            Join <span style={{ color: "var(--accent)" }}>{displayName}</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {info.role === "club"
              ? "You've been invited as a club admin. Create your account to join."
              : <>You've been invited as a {info.role}{info.role === "parent" && info.player_name ? ` of ${info.player_name}` : ""}. Create your account to join.</>}
          </p>
        </div>

        <div className="glass-panel p-6">
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Your name</label>
              <input className="input-dark w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Email</label>
              <input type="email" className="input-dark w-full mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Password</label>
              <input type="password" className="input-dark w-full mt-1" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>

            {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
            {notice && <p className="text-sm" style={{ color: "var(--gold-light)" }}>{notice}</p>}

            <button type="submit" className="btn-accent w-full py-3 rounded-lg mt-2" disabled={loading}>
              {loading ? "Please wait…" : `Join as ${info.role}`}
            </button>
          </form>
          <p className="text-xs mt-4 mb-2" style={{ color: "var(--muted)" }}>By joining you agree to the terms and privacy policy.</p>
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
