import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { toDateString } from "../lib/utils.js";
import { buildFixturesHtml } from "../lib/gazette.js";
import { GazetteView } from "./MatchDay.jsx";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad2 = (n) => String(n).padStart(2, "0");

// Club view: tick the days you want, get a printable / downloadable fixtures list.
export default function FixturesList({ teams, clubId, onBack }) {
  const todayStr = toDateString(new Date());
  const now = new Date();
  const [monthCursor, setMonthCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(new Set());
  const [matchDates, setMatchDates] = useState(new Set());
  const [club, setClub] = useState(null);
  const [showTimes, setShowTimes] = useState(true);
  const [showLocations, setShowLocations] = useState(false);
  const [result, setResult] = useState(null); // built html
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);

  useEffect(() => {
    if (!clubId) return;
    supabase.from("clubs").select("name, logo_url, theme").eq("id", clubId).maybeSingle().then(({ data }) => setClub(data || null));
  }, [clubId]);

  useEffect(() => {
    if (teamIds.length === 0) return;
    supabase
      .from("calendar_events")
      .select("date")
      .in("team_id", teamIds)
      .eq("type", "match")
      .gte("date", `${year}-${pad2(month + 1)}-01`)
      .lte("date", `${year}-${pad2(month + 1)}-31`)
      .then(({ data }) => setMatchDates(new Set((data || []).map((e) => e.date))));
  }, [teamIds, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const dateStr = (d) => `${year}-${pad2(month + 1)}-${pad2(d)}`;

  const toggle = (ds) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(ds) ? n.delete(ds) : n.add(ds);
      return n;
    });

  const addWeekday = (wd) =>
    setSelected((s) => {
      const n = new Set(s);
      for (let d = 1; d <= daysInMonth; d++) if (new Date(year, month, d).getDay() === wd) n.add(dateStr(d));
      return n;
    });

  const create = async () => {
    setBusy(true);
    setError("");
    const dates = [...selected].sort();
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .in("team_id", teamIds)
      .eq("type", "match")
      .in("date", dates);
    setBusy(false);
    if (error) return setError(error.message);
    const teamName = (id) => teams.find((t) => t.id === id)?.name || "Team";
    const groups = dates.map((date) => ({
      date,
      fixtures: (data || [])
        .filter((e) => e.date === date)
        .sort((a, b) => (a.time || "").localeCompare(b.time || "") || teamName(a.team_id).localeCompare(teamName(b.team_id)))
        .map((e) => ({ team: teamName(e.team_id), opponent: e.opponent, time: e.time, location: e.location })),
    }));
    setResult({ groups });
  };

  const html = result
    ? buildFixturesHtml({
        clubName: club?.name || "Club",
        clubLogo: club?.logo_url,
        emblemShape: club?.theme?.emblem_shape === "round" ? "round" : "square",
        groups: result.groups,
        showTimes,
        showLocations,
      })
    : null;

  if (html) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button className="text-sm flex items-center gap-1 mb-4" style={{ color: "var(--muted)" }} onClick={() => setResult(null)}>
          <ArrowLeft className="w-3.5 h-3.5" /> Change days
        </button>
        <div className="flex gap-4 flex-wrap mb-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={showTimes} onChange={(e) => setShowTimes(e.target.checked)} /> Show kick-off times</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showLocations} onChange={(e) => setShowLocations(e.target.checked)} /> Show locations</label>
        </div>
        <GazetteView html={html} fileName={`${club?.name || "Club"} Fixtures`} />
      </div>
    );
  }

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button className="text-sm flex items-center gap-1 mb-6" style={{ color: "var(--muted)" }} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to club calendar
      </button>
      <h1 className="font-display text-2xl tracking-wide mb-1">Fixtures list</h1>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Tap the days you want. Every team's matches on those days are pulled from the calendar into one list you can print or download.
      </p>

      <div className="flex gap-2 flex-wrap mb-4">
        <button className="btn-ghost px-3 py-1.5 rounded-lg text-sm" onClick={() => addWeekday(6)}>All Saturdays</button>
        <button className="btn-ghost px-3 py-1.5 rounded-lg text-sm" onClick={() => addWeekday(0)}>All Sundays</button>
        <button className="btn-ghost px-3 py-1.5 rounded-lg text-sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Clear</button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button className="btn-ghost p-2 rounded-lg" onClick={() => setMonthCursor(new Date(year, month - 1, 1))} title="Previous month"><ArrowLeft className="w-4 h-4" /></button>
        <h2 className="font-display text-lg tracking-wide">{monthLabel}</h2>
        <button className="btn-ghost p-2 rounded-lg" onClick={() => setMonthCursor(new Date(year, month + 1, 1))} title="Next month"><ChevronRight className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-center text-[10px] uppercase tracking-wide py-1" style={{ color: "var(--muted)" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const ds = dateStr(d);
          const on = selected.has(ds);
          return (
            <button
              key={i}
              data-day={ds}
              className="aspect-square rounded-lg flex flex-col items-center justify-center gap-1"
              style={{
                background: on ? "var(--accent)" : "rgba(255,255,255,0.04)",
                border: ds === todayStr ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => toggle(ds)}
            >
              <span className="text-sm font-mono">{d}</span>
              {matchDates.has(ds) && <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : "var(--accent)" }} />}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm mb-3" style={{ color: "#f28f8a" }}>{error}</p>}
      <button className="btn-accent px-5 py-2.5 rounded-lg disabled:opacity-40" disabled={selected.size === 0 || busy} onClick={create}>
        {busy ? "Creating…" : `Create fixtures list (${selected.size} ${selected.size === 1 ? "day" : "days"})`}
      </button>
      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>A dot under a day means there's at least one match that day. You can select days across several months.</p>
    </div>
  );
}
