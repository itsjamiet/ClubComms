import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import ClubAuth from "./pages/ClubAuth.jsx";
import ClubDashboard from "./pages/ClubDashboard.jsx";
import AcceptInvite from "./pages/AcceptInvite.jsx";
import CoachTeamPage from "./pages/CoachTeamPage.jsx";
import ParentDashboard from "./pages/ParentDashboard.jsx";

function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function pentPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI / 180) * (-90 + 72 * i);
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function FootballIcon({ size = "0.55em" }) {
  const hexSize = 15;
  const strokeProps = { stroke: "#111827", strokeWidth: 1.6, strokeLinejoin: "round" };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "inline-block", verticalAlign: "-0.08em", flexShrink: 0 }}
    >
      <defs>
        <clipPath id="ballClip2">
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#ffffff" stroke="#111827" strokeWidth="3" />
      <g clipPath="url(#ballClip2)">
        {/* top hex, cropped by the ball's edge */}
        <polygon points={hexPoints(50, 11, hexSize)} fill="#111827" {...strokeProps} />
        {/* ring of hexes around the center */}
        <polygon points={hexPoints(76, 50, hexSize)} fill="#111827" {...strokeProps} />
        <polygon points={hexPoints(63, 72.5, hexSize)} fill="#ffffff" {...strokeProps} />
        <polygon points={hexPoints(37, 72.5, hexSize)} fill="#111827" {...strokeProps} />
        <polygon points={hexPoints(24, 50, hexSize)} fill="#ffffff" {...strokeProps} />
        <polygon points={hexPoints(37, 27.5, hexSize)} fill="#ffffff" {...strokeProps} />
        <polygon points={hexPoints(63, 27.5, hexSize)} fill="#ffffff" {...strokeProps} />
        {/* center pentagon, connecting the hexes like a real ball */}
        <polygon points={pentPoints(50, 50, 13)} fill="#111827" {...strokeProps} />
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke="#111827" strokeWidth="3" />
    </svg>
  );
}

function SplashScreen({ fadingOut }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center transition-opacity duration-300"
      style={{
        zIndex: 100,
        background: "linear-gradient(160deg, #060b16 0%, #0b1730 45%, #0f1e3d 100%)",
        opacity: fadingOut ? 0 : 1,
      }}
    >
      <div
        className="font-display flex items-center"
        style={{
          fontSize: "3.2rem",
          fontWeight: 800,
          letterSpacing: "0.01em",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
        }}
      >
        <span
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, var(--accent) 60%, var(--accent-dark) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ClubC
        </span>
        <FootballIcon />
        <span
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, var(--accent) 60%, var(--accent-dark) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          mms
        </span>
      </div>
      <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Team management, built for matchday.</p>
    </div>
  );
}

// Shown right after a club logs in for the first time, if their signup
// didn't get to create the club row yet (e.g. email confirmation was
// required, so the browser tab that finally has an active session is a
// fresh one that never ran the signup form).
function CreateClubForm({ onCreated }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data: club, error: clubError } = await supabase.rpc("create_my_club", { club_name: name });
    if (clubError) {
      setError(clubError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    onCreated(club);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-6">
        <h1 className="font-display text-2xl tracking-wide mb-1">Set up your club</h1>
        <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
          Your account is confirmed — last step, name your club.
        </p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Club name</label>
            <input className="input-dark w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Westland Sports FC" required autoFocus />
          </div>
          {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
          <button type="submit" className="btn-accent w-full py-3 rounded-lg mt-2" disabled={loading}>
            {loading ? "Creating…" : "Create club"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [splashPhase, setSplashPhase] = useState("visible"); // "visible" -> "fading" -> "gone"
  const [inviteId] = useState(() => new URLSearchParams(window.location.search).get("invite"));
  const [inviteDone, setInviteDone] = useState(false);

  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = logged out
  const [profile, setProfile] = useState(null);
  const [club, setClub] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashPhase("fading"), 2300);
    const t2 = setTimeout(() => setSplashPhase("gone"), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setClub(null);
      return;
    }
    setLoadingProfile(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        setLoadingProfile(false);
        if (!error) setProfile(data);
      });
  }, [session]);

  useEffect(() => {
    if (!profile?.club_id) {
      setClub(null);
      return;
    }
    supabase
      .from("clubs")
      .select("*")
      .eq("id", profile.club_id)
      .single()
      .then(({ data, error }) => {
        if (!error) setClub(data);
      });
  }, [profile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Splash screen always shows first, ahead of invite links, login, everything.
  if (splashPhase !== "gone") {
    return <SplashScreen fadingOut={splashPhase === "fading"} />;
  }

  // Invite links take priority over everything else, whether or not
  // the person already has a session.
  if (inviteId && !inviteDone) {
    return (
      <AcceptInvite
        inviteId={inviteId}
        session={session === undefined ? null : session}
        onDone={() => {
          window.history.replaceState({}, "", window.location.pathname);
          setInviteDone(true);
        }}
      />
    );
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <ClubAuth />;
  }

  if (loadingProfile || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted)" }}>Loading your account…</p>
      </div>
    );
  }

  if (profile.role === "coach") {
    return <CoachTeamPage profile={profile} onSignOut={handleSignOut} />;
  }

  if (profile.role === "parent") {
    return <ParentDashboard profile={profile} onSignOut={handleSignOut} />;
  }

  if (!profile.club_id) {
    return <CreateClubForm onCreated={setClub} />;
  }

  if (!club) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted)" }}>Loading your club…</p>
      </div>
    );
  }

  return <ClubDashboard profile={profile} club={club} onSignOut={handleSignOut} />;
}

