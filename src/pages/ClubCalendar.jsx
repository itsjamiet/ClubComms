import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { toDateString } from "../lib/utils.js";
import ClubEvents from "./ClubEvents.jsx";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function KitIcon({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "#888"} stroke="rgba(255,255,255,0.6)" strokeWidth="0.6">
      <path d="M8 2.5 L2 6 L4.5 10 L7 8.3 V21 H17 V8.3 L19.5 10 L22 6 L16 2.5 C15 4 13.6 5 12 5 C10.4 5 9 4 8 2.5 Z" />
    </svg>
  );
}

function mapLink(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function ClubCalendarDay({ dateStr, teams, onBack }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const teamIds = teams.map((t) => t.id);
    if (teamIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    supabase
      .from("calendar_events")
      .select("*")
      .in("team_id", teamIds)
      .eq("date", dateStr)
      .then(({ data }) => {
        setEvents((data || []).slice().sort((a, b) => (a.time || "").localeCompare(b.time || "")));
        setLoading(false);
      });
  }, [dateStr, teams]);

  const teamName = (id) => teams.find((t) => t.id === id)?.name || "Team";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button className="text-sm flex items-center gap-1 mb-6" style={{ color: "var(--muted)" }} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to calendar
      </button>
      <h1 className="font-display text-2xl tracking-wide mb-6">
        {new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </h1>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : events.length === 0 ? (
        <div className="glass-panel p-8 text-center" style={{ color: "var(--muted)" }}>Nothing scheduled this day.</div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium">{teamName(ev.team_id)}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: ev.type === "match" ? "rgba(232,67,61,0.18)" : "rgba(46,124,246,0.18)", color: ev.type === "match" ? "#f28f8a" : "#8fb8ff" }}
                >
                  {ev.type === "match" ? "Match" : "Training"}
                </span>
                {ev.type === "match" && (ev.home_color || ev.away_color) && (
                  <span className="flex items-center gap-1">
                    {ev.home_color && <KitIcon color={ev.home_color} />}
                    {ev.away_color && <KitIcon color={ev.away_color} />}
                  </span>
                )}
              </div>
              {ev.type === "match" ? (
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
                    Match vs {ev.opponent || "TBC"}
                  </span>
                  {(ev.our_score !== null && ev.our_score !== undefined && ev.their_score !== null && ev.their_score !== undefined) && (
                    <span className="font-display font-mono" style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--gold-light)" }}>
                      {ev.our_score} - {ev.their_score}
                    </span>
                  )}
                  {ev.title && <span className="font-display text-base" style={{ color: "var(--muted)" }}>- {ev.title}</span>}
                </div>
              ) : (
                <div className="font-display text-lg tracking-wide">{ev.title || "Training session"}</div>
              )}
              <div className="text-xs mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--muted)" }}>
                {ev.time && <span>{ev.time}</span>}
                {ev.location && (
                  <a
                    href={mapLink(ev.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    {ev.location}
                  </a>
                )}
              </div>
              {ev.notes && <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>{ev.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClubCalendarTab({ teams, role = "club", userId, clubId, onResponded }) {
  const todayStr = toDateString(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventDates, setEventDates] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();

  useEffect(() => {
    const teamIds = teams.map((t) => t.id);
    if (teamIds.length === 0) {
      setEventDates(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;
    supabase
      .from("calendar_events")
      .select("date")
      .in("team_id", teamIds)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .then(({ data }) => {
        setEventDates(new Set((data || []).map((e) => e.date)));
        setLoading(false);
      });
  }, [teams, year, month]);

  if (selectedDate) {
    return <ClubCalendarDay dateStr={selectedDate} teams={teams} onBack={() => setSelectedDate(null)} />;
  }

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pad2 = (n) => String(n).padStart(2, "0");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-6">Club Calendar</h1>

      <ClubEvents role={role} clubId={clubId || teams[0]?.club_id} userId={userId} onResponded={onResponded} />

      <h2 className="font-display text-xl tracking-wide mb-1">Team calendar</h2>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Matches and training from every team, in one place. Tap a day for details.
      </p>

      <div className="flex items-center justify-between mb-4">
        <button className="btn-ghost p-2 rounded-lg" onClick={() => setMonthCursor(new Date(year, month - 1, 1))} title="Previous month">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="font-display text-lg tracking-wide">{monthLabel}</h2>
        <button className="btn-ghost p-2 rounded-lg" onClick={() => setMonthCursor(new Date(year, month + 1, 1))} title="Next month">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-center text-[10px] uppercase tracking-wide py-1" style={{ color: "var(--muted)" }}>{w}</div>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
            const hasEvents = eventDates.has(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <button
                key={i}
                className="aspect-square rounded-lg flex flex-col items-center justify-center gap-1"
                style={{ background: "rgba(255,255,255,0.04)", border: isToday ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.08)" }}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="text-sm font-mono">{d}</span>
                {hasEvents && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>
      )}

      {teams.length === 0 && (
        <div className="glass-panel p-8 text-center mt-6" style={{ color: "var(--muted)" }}>No teams yet — create one on the Teams tab.</div>
      )}
    </div>
  );
}

