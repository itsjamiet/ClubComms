import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import ClubAuth from "./pages/ClubAuth.jsx";
import ClubDashboard from "./pages/ClubDashboard.jsx";
import AcceptInvite from "./pages/AcceptInvite.jsx";
import CoachTeamPage from "./pages/CoachTeamPage.jsx";
import ParentDashboard from "./pages/ParentDashboard.jsx";
import { SPLASH_LOGO } from "./assets/splashLogo.js";

function SplashScreen({ fadingOut }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center transition-opacity duration-300"
      style={{
        zIndex: 100,
        background: "radial-gradient(circle at 50% 45%, #0b1730 0%, #060b16 70%)",
        opacity: fadingOut ? 0 : 1,
      }}
    >
      <img
        src={SPLASH_LOGO}
        alt="ClubComms"
        style={{
          width: "min(80vw, 420px)",
          height: "auto",
          WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 55%, transparent 100%)",
          maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 55%, transparent 100%)",
        }}
      />
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

