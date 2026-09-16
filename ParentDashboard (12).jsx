import { useEffect, useState } from "react";
import { Shield, LogOut, Users, ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
import MatchDayView from "./MatchDay.jsx";
import DocumentsView from "./Documents.jsx";
import TrainingSessionView, { Quadrant } from "./TrainingSession.jsx";
import ClubCalendarTab from "./ClubCalendar.jsx";

const PLAN_STATUSES = [
  { id: "needs_practice", label: "Needs practice", color: "#E8433D" },
  { id: "improving", label: "Improving", color: "#F2A31D" },
  { id: "mastered", label: "Mastered", color: "#1FB65A" },
];

function sortByNumber(players) {
  return [...players].sort((a, b) => {
    const na = a.number === "" || a.number === null || a.number === undefined ? Infinity : Number(a.number);
    const nb = b.number === "" || b.number === null || b.number === undefined ? Infinity : Number(b.number);
    return na - nb;
  });
}

function PlayerCard({ player, onOpen }) {
  return (
    <button className="glass-card flex flex-col items-center text-center p-4" onClick={() => onOpen(player)}>
      <div
        className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 mb-3 flex items-center justify-center"
        style={{ borderColor: "var(--accent)", background: "rgba(255,255,255,0.04)" }}
      >
        {player.photo_url ? (
          <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <Users className="w-8 h-8" style={{ color: "var(--muted)" }} />
        )}
      </div>
      <div className="font-medium truncate w-full">{player.name || "Unnamed player"}</div>
      <div className="text-xs mt-1 flex items-center justify-center gap-2" style={{ color: "var(--muted)" }}>
        <span className="font-mono">#{player.number || "—"}</span>
        <span>·</span>
        <span>Age {player.age || "—"}</span>
      </div>
      <div className="text-xs mt-1 font-mono px-2 py-0.5 rounded-full" style={{ color: "var(--accent)", background: "rgba(46,124,246,0.12)" }}>
        {player.position}
      </div>
    </button>
  );
}

function ReadOnlyTrainingPlan({ playerId }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openDrillsRowId, setOpenDrillsRowId] = useState(null);

  useEffect(() => {
    supabase
      .from("training_plans")
      .select("rows")
      .eq("player_id", playerId)
      .maybeSingle()
      .then(({ data, error }) => {
        setRows(error ? null : data?.rows || []);
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>;
  if (rows === null) return <p className="text-sm" style={{ color: "var(--muted)" }}>Couldn't load the plan.</p>;
  if (rows.length === 0) return <p className="text-sm" style={{ color: "var(--muted)" }}>No focus areas added yet.</p>;

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const status = PLAN_STATUSES.find((s) => s.id === row.status) || PLAN_STATUSES[0];
        const drills = row.drills || [];
        return (
          <div key={row.id} className="glass-card p-3">
            <div className="font-medium">{row.title || "Untitled"}</div>
            {row.content && <div className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{row.content}</div>}
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full inline-block"
                style={{ background: status.color, color: "#0b1223", fontWeight: 700 }}
              >
                {status.label}
              </span>
              {drills.length > 0 && (
                <button
                  className="text-xs"
                  style={{ color: "var(--accent)" }}
                  onClick={() => setOpenDrillsRowId(openDrillsRowId === row.id ? null : row.id)}
                >
                  Improvement drills ({drills.length})
                </button>
              )}
            </div>

            {openDrillsRowId === row.id && (
              <div className="space-y-4 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {drills.map((drill) => (
                  <div key={drill.id} className="glass-panel p-4">
                    <div className="font-display text-base mb-3">{drill.title || "Untitled drill"}</div>
                    <Quadrant
                      index={drill.id}
                      quadrant={drill.pitch || { markers: [], arrows: [] }}
                      setQuadrant={() => {}}
                      tool={null}
                      editable={false}
                      label="Drill pitch"
                      showNotes={false}
                    />
                    {drill.description && (
                      <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>{drill.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function statTotals(stats) {
  const goalsTotal = stats.reduce((s, x) => s + (Number(x.goals) || 0), 0);
  const savesTotal = stats.reduce((s, x) => s + (Number(x.saves) || 0), 0);
  const tacklesTotal = stats.reduce((s, x) => s + (Number(x.tackles) || 0), 0);
  const captainTotal = stats.filter((x) => x.captain).length;
  const potmTotal = stats.filter((x) => x.potm).length;
  const minutesPlayedTotal = stats.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  const matchMinutesTotal = stats.reduce((s, x) => s + (Number(x.matchMinutes) || 0), 0);
  const minutesPct = matchMinutesTotal > 0 ? Math.round((minutesPlayedTotal / matchMinutesTotal) * 100) : null;
  return { goalsTotal, savesTotal, tacklesTotal, captainTotal, potmTotal, minutesPct };
}

function ReadOnlyWeeklyStats({ stats }) {
  if (!stats || stats.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>No stats logged yet.</p>;
  }
  const t = statTotals(stats);
  const boxes = [
    { label: "Minutes played", value: t.minutesPct === null ? "—" : `${t.minutesPct}%` },
    { label: "Goals", value: t.goalsTotal },
    { label: "Saves", value: t.savesTotal },
    { label: "Tackles", value: t.tacklesTotal },
    { label: "Captain", value: t.captainTotal },
    { label: "Player of the match", value: t.potmTotal },
  ];
  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 mb-4">
        {stats.map((s) => (
          <div key={s.id} className="glass-card p-4 w-56 flex-shrink-0">
            <div className="text-xs" style={{ color: "var(--muted)" }}>{s.date}{s.opponent ? ` · vs ${s.opponent}` : ""}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-sm">
              <div>Mins: <span className="font-mono">{s.minutes || 0}/{s.matchMinutes || 0}</span></div>
              <div>Goals: <span className="font-mono">{s.goals || 0}</span></div>
              <div>Tackles: <span className="font-mono">{s.tackles || 0}</span></div>
              <div>Saves: <span className="font-mono">{s.saves || 0}</span></div>
            </div>
            {(s.captain || s.potm) && (
              <div className="flex gap-1.5 mt-2">
                {s.captain && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>Captain</span>}
                {s.potm && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(212,175,55,0.18)", color: "#f1d97a" }}>POTM</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {boxes.map((b) => (
          <div key={b.label} className="glass-card p-4">
            <div className="text-2xl font-mono">{b.value}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{b.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function PlayerView({ player, isOwnChild, onBack }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button className="text-sm flex items-center gap-1 mb-6" style={{ color: "var(--muted)" }} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to team
      </button>

      <div className="flex flex-col items-center mb-8">
        <div
          className="w-28 h-28 rounded-full overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: "var(--accent)", background: "rgba(255,255,255,0.04)" }}
        >
          {player.photo_url ? (
            <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <Users className="w-9 h-9" style={{ color: "var(--muted)" }} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-4">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Name</div>
          <div className="font-display text-lg mt-1">{player.name || "—"}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Number</div>
          <div className="font-mono text-lg mt-1">#{player.number || "—"}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Age</div>
          <div className="text-lg mt-1">{player.age || "—"}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Position</div>
          <div className="text-lg mt-1">{player.position}</div>
        </div>
      </div>

      <div className="glass-panel p-6 mb-6">
        <h2 className="font-display text-lg mb-1">Weekly stats</h2>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Visible to every parent on the team.</p>
        <ReadOnlyWeeklyStats stats={player.stats} />
      </div>
    </div>
  );
}

function KitIcon({ color, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "#888"} stroke="rgba(255,255,255,0.6)" strokeWidth="0.6">
      <path d="M8 2.5 L2 6 L4.5 10 L7 8.3 V21 H17 V8.3 L19.5 10 L22 6 L16 2.5 C15 4 13.6 5 12 5 C10.4 5 9 4 8 2.5 Z" />
    </svg>
  );
}

function mapLink(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function ParentEventCard({ event, players, ownChildIds }) {
  const [expanded, setExpanded] = useState(false);
  const [rsvps, setRsvps] = useState(null);

  const loadRsvps = async () => {
    const { data } = await supabase.from("rsvps").select("*").eq("event_id", event.id);
    const map = {};
    (data || []).forEach((r) => { map[r.player_id] = r; });
    setRsvps(map);
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !rsvps) loadRsvps();
  };

  const setStatus = async (playerId, status) => {
    if (!ownChildIds.has(playerId)) return;
    const { error } = await supabase.rpc("submit_rsvp", { p_event_id: event.id, p_player_id: playerId, p_status: status });
    if (!error) loadRsvps();
  };

  return (
    <div className="glass-card p-4">
      <div className="cursor-pointer" onClick={toggle}>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: event.type === "match" ? "rgba(232,67,61,0.18)" : "rgba(46,124,246,0.18)", color: event.type === "match" ? "#f28f8a" : "#8fb8ff" }}
          >
            {event.type === "match" ? "Match" : "Training"}
          </span>
          {event.type === "match" && (event.home_color || event.away_color) && (
            <span className="flex items-center gap-1">
              {event.home_color && <KitIcon color={event.home_color} size={18} />}
              {event.away_color && <KitIcon color={event.away_color} size={18} />}
            </span>
          )}
        </div>
        {event.type === "match" ? (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="font-display"
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                background: "linear-gradient(180deg, #ffffff 0%, var(--accent) 55%, var(--accent-dark) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
              }}
            >
              Match vs {event.opponent || "TBC"}
            </span>
            {(event.our_score !== null && event.our_score !== undefined && event.their_score !== null && event.their_score !== undefined) && (
              <span className="font-display font-mono" style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--gold-light)" }}>
                {event.our_score} - {event.their_score}
              </span>
            )}
            {event.title && <span className="font-display text-base" style={{ color: "var(--muted)" }}>- {event.title}</span>}
          </div>
        ) : (
          <div className="font-display text-lg tracking-wide">{event.title || "Training session"}</div>
        )}
        <div className="text-xs mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--muted)" }}>
          <span>{event.date}{event.time ? ` · ${event.time}` : ""}</span>
          {event.location && (
            <a
              href={mapLink(event.location)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              {event.location}
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {event.notes && <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>{event.notes}</p>}
          {!rsvps ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
          ) : (
            players.map((p) => {
              const r = rsvps[p.id] || { status: "pending" };
              const isOwn = ownChildIds.has(p.id);
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg flex-wrap" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-sm flex-1 min-w-[100px]">{p.name || "Unnamed"}{isOwn ? " (your child)" : ""}</span>
                  <button
                    className="text-xs px-3 py-1.5 rounded-full font-medium disabled:cursor-default"
                    style={{
                      background: r.status === "attending" ? "#1FB65A" : "rgba(255,255,255,0.06)",
                      color: r.status === "attending" ? "#0b1223" : "var(--muted)",
                    }}
                    onClick={() => setStatus(p.id, "attending")}
                    disabled={!isOwn}
                  >
                    Attend
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 rounded-full font-medium disabled:cursor-default"
                    style={{
                      background: r.status === "not_attending" ? "#E8433D" : "rgba(255,255,255,0.06)",
                      color: r.status === "not_attending" ? "white" : "var(--muted)",
                    }}
                    onClick={() => setStatus(p.id, "not_attending")}
                    disabled={!isOwn}
                  >
                    Decline
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ParentCalendar({ team, ownChildIds }) {
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("upcoming"); // "upcoming" | "previous"

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("calendar_events").select("*").eq("team_id", team.id).order("date"),
      supabase.from("players").select("id, name, number").eq("team_id", team.id),
    ]).then(([{ data: ev }, { data: pl }]) => {
      setEvents(ev || []);
      setPlayers(pl || []);
      setLoading(false);
    });
  }, [team.id]);

  const todayStr = toDateString(new Date());
  const upcomingEvents = events.filter((e) => e.date >= todayStr);
  const previousEvents = events.filter((e) => e.date < todayStr).slice().sort((a, b) => b.date.localeCompare(a.date));

  if (view === "previous") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button className="text-sm flex items-center gap-1 mb-6" style={{ color: "var(--muted)" }} onClick={() => setView("upcoming")}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to calendar
        </button>
        <h1 className="font-display text-2xl tracking-wide mb-2">Previous Events</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          Matches and training move here automatically once their date has passed.
        </p>
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : previousEvents.length === 0 ? (
          <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No past events yet.</div>
        ) : (
          <div className="space-y-3">
            {previousEvents.map((ev) => (
              <ParentEventCard key={ev.id} event={ev} players={players} ownChildIds={ownChildIds} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="font-display text-2xl tracking-wide">Calendar</h1>
        <button className="btn-ghost px-4 py-2 rounded-lg text-sm" onClick={() => setView("previous")}>Previous</button>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        You can see the whole team's schedule — tap your own child's RSVP to update it.
      </p>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : upcomingEvents.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No upcoming events on the calendar yet.</div>
      ) : (
        <div className="space-y-3">
          {upcomingEvents.map((ev) => (
            <ParentEventCard key={ev.id} event={ev} players={players} ownChildIds={ownChildIds} />
          ))}
        </div>
      )}
    </div>
  );
}

function ParentTrainingPlansTab({ children }) {
  const [openChild, setOpenChild] = useState(null);

  if (openChild) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button className="text-sm flex items-center gap-1 mb-6" style={{ color: "var(--muted)" }} onClick={() => setOpenChild(null)}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to training plans
        </button>
        <h1 className="font-display text-2xl tracking-wide mb-1">{openChild.name || "Unnamed player"}</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Only visible to you, as this player's parent.</p>
        <ReadOnlyTrainingPlan playerId={openChild.id} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-6">Training Plans</h1>
      <div className="space-y-2">
        {children.map((c) => (
          <button key={c.id} className="glass-card w-full flex items-center gap-3 p-3 text-left" onClick={() => setOpenChild(c)}>
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2" style={{ borderColor: "var(--accent)" }}>
              <Users className="w-4 h-4 m-3" style={{ color: "var(--muted)" }} />
            </div>
            <span className="flex-1 font-medium">{c.name || "Unnamed player"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ParentMatchDaysTab({ teamId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMatchdayId, setOpenMatchdayId] = useState(null);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("calendar_events")
      .select("*")
      .eq("team_id", teamId)
      .eq("type", "match")
      .order("date", { ascending: false })
      .then(async ({ data: events }) => {
        const eventIds = (events || []).map((e) => e.id);
        const { data: mds } = eventIds.length
          ? await supabase.from("matchdays").select("id, event_id").in("event_id", eventIds)
          : { data: [] };
        const mdByEvent = Object.fromEntries((mds || []).map((m) => [m.event_id, m.id]));
        setMatches((events || []).map((e) => ({ ...e, matchdayId: mdByEvent[e.id] || null })));
        setLoading(false);
      });
  }, [teamId]);

  if (openMatchdayId) {
    return (
      <div>
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <button className="text-sm flex items-center gap-1" style={{ color: "var(--muted)" }} onClick={() => setOpenMatchdayId(null)}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to match days
          </button>
        </div>
        <MatchDayView matchdayId={openMatchdayId} teamId={teamId} editable={false} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-1">Match Days</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Squad selections, goals, and comments for each match.
      </p>
      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : matches.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No matches on the calendar yet.</div>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <button
              key={m.id}
              className="glass-card w-full flex items-center gap-3 p-3 text-left disabled:opacity-50"
              disabled={!m.matchdayId}
              onClick={() => m.matchdayId && setOpenMatchdayId(m.matchdayId)}
            >
              <div className="flex-1">
                <div className="font-medium">
                  {m.title || `vs ${m.opponent || "TBC"}`}
                  {m.our_score !== null && m.our_score !== undefined && m.their_score !== null && m.their_score !== undefined && (
                    <span className="ml-2 font-mono text-sm" style={{ color: "var(--gold-light)" }}>{m.our_score} - {m.their_score}</span>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {m.date}{m.time ? ` · ${m.time}` : ""}{m.location ? ` · ${m.location}` : ""}
                  {!m.matchdayId && " · No lineup published yet"}
                </div>
              </div>
              {m.matchdayId && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--muted)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentDashboard({ profile, onSignOut }) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState("team");
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [openPlayer, setOpenPlayer] = useState(null);

  useEffect(() => {
    supabase
      .from("parent_child_links")
      .select("players(id, name, team_id, teams(id, name))")
      .eq("parent_id", profile.id)
      .then(({ data }) => {
        const kids = (data || []).map((r) => r.players).filter(Boolean);
        setChildren(kids);
        if (kids.length) setActiveTeamId(kids[0].team_id);
        setLoading(false);
      });
  }, [profile]);

  useEffect(() => {
    if (!activeTeamId) return;
    setRosterLoading(true);
    supabase
      .from("players")
      .select("*")
      .eq("team_id", activeTeamId)
      .then(({ data }) => {
        setRoster(data || []);
        setRosterLoading(false);
      });
  }, [activeTeamId]);

  const teamsMap = {};
  children.forEach((c) => {
    if (c.teams) teamsMap[c.team_id] = c.teams;
  });
  const teamOptions = Object.values(teamsMap);
  const ownChildIds = new Set(children.map((c) => c.id));

  const [clubTeams, setClubTeams] = useState([]);
  useEffect(() => {
    if (!activeTeamId) return;
    supabase.from("teams").select("club_id").eq("id", activeTeamId).single().then(({ data }) => {
      if (!data?.club_id) return;
      supabase.from("teams").select("id, name, logo_url").eq("club_id", data.club_id).then(({ data: ct }) => {
        setClubTeams(ct || []);
      });
    });
  }, [activeTeamId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-6 max-w-sm text-center">
          <p className="mb-4" style={{ color: "var(--muted)" }}>You're not linked to a child yet — ask your coach for an invite link.</p>
          <button className="btn-accent px-4 py-2 rounded-lg" onClick={onSignOut}>Log out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between px-6 h-16" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5" style={{ color: "var(--accent)" }} />
          {teamOptions.length > 1 ? (
            <select
              className="text-sm py-1.5 px-2 rounded-lg"
              style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
              value={activeTeamId}
              onChange={(e) => { setActiveTeamId(e.target.value); setOpenPlayer(null); }}
            >
              {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <span className="font-display text-lg tracking-wide">{teamsMap[activeTeamId]?.name}</span>
          )}
        </div>
        <button className="btn-ghost p-2 rounded-lg" onClick={onSignOut} title="Log out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {!openPlayer && (
        <div className="flex gap-2 px-6 pt-4">
          <button
            className={activeTab === "team" ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab("team")}
          >
            Team
          </button>
          <button
            className={activeTab === "calendar" ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab("calendar")}
          >
            Calendar
          </button>
          <button
            className={activeTab === "clubCalendar" ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab("clubCalendar")}
          >
            Club Calendar
          </button>
          <button
            className={activeTab === "matchday" ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab("matchday")}
          >
            Match Day
          </button>
          <button
            className={activeTab === "plans" ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab("plans")}
          >
            Training Plans
          </button>
          <button
            className={activeTab === "session" ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab("session")}
          >
            Training Session
          </button>
          <button
            className={activeTab === "documents" ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab("documents")}
          >
            Documents
          </button>
        </div>
      )}

      {openPlayer ? (
        <PlayerView player={openPlayer} isOwnChild={ownChildIds.has(openPlayer.id)} onBack={() => setOpenPlayer(null)} />
      ) : activeTab === "calendar" ? (
        <ParentCalendar team={{ id: activeTeamId }} ownChildIds={ownChildIds} />
      ) : activeTab === "clubCalendar" ? (
        <ClubCalendarTab teams={clubTeams} />
      ) : activeTab === "matchday" ? (
        <ParentMatchDaysTab teamId={activeTeamId} />
      ) : activeTab === "plans" ? (
        <ParentTrainingPlansTab children={children.filter((c) => c.team_id === activeTeamId)} />
      ) : activeTab === "session" ? (
        <TrainingSessionView team={{ id: activeTeamId }} editable={false} />
      ) : activeTab === "documents" ? (
        <DocumentsView team={{ id: activeTeamId }} editable={false} />
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="font-display text-2xl tracking-wide mb-6">{teamsMap[activeTeamId]?.name}</h1>
          {rosterLoading ? (
            <p style={{ color: "var(--muted)" }}>Loading…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {sortByNumber(roster).map((p) => (
                <PlayerCard key={p.id} player={p} onOpen={setOpenPlayer} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
