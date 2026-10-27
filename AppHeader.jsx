import { useEffect, useState } from "react";
import { Shield, LogOut } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";

// Looks up the club (name + emblem) that a team belongs to, so every team
// screen can show the same emblem the club uploaded once in Settings.
export function useClubForTeam(teamId) {
  const [club, setClub] = useState(null);
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    (async () => {
      const { data: t } = await supabase.from("teams").select("club_id").eq("id", teamId).maybeSingle();
      if (!t?.club_id) return;
      const { data: c } = await supabase.from("clubs").select("id, name, logo_url").eq("id", t.club_id).maybeSingle();
      if (!cancelled && c) setClub(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);
  return club;
}

function Emblem({ logo, size }) {
  if (logo) {
    return <img src={logo} alt="" style={{ height: size, width: size, objectFit: "contain" }} className="flex-shrink-0" />;
  }
  return <Shield style={{ height: size * 0.7, width: size * 0.7, color: "var(--accent)" }} className="flex-shrink-0" />;
}

// Centred title bar: [emblem] NAME [emblem], with optional left / right slots.
export default function AppHeader({ title, subtitle, logo, left, onSignOut }) {
  return (
    <div
      className="grid items-center px-3 sm:px-6 py-3"
      style={{ gridTemplateColumns: "1fr auto 1fr", borderBottom: "1px solid rgba(255,255,255,0.08)", minHeight: 72 }}
    >
      <div className="flex items-center min-w-0">{left}</div>
      <div className="flex flex-col items-center text-center min-w-0 px-2">
        <div className="flex items-center justify-center gap-3">
          <Emblem logo={logo} size={44} />
          <span className="font-display text-2xl sm:text-3xl tracking-wide leading-tight">{title}</span>
          <Emblem logo={logo} size={44} />
        </div>
        {subtitle && (
          <span className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">
        {onSignOut && (
          <button className="btn-ghost p-2 rounded-lg" onClick={onSignOut} title="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
