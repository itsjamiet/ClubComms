import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, Printer, Star, Shield as ShieldIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { useClubForTeam } from "../components/AppHeader.jsx";
import { findStatIndex } from "../lib/utils.js";
import { buildGazetteHtml, downloadGazettePng, printGazette, GAZETTE_WIDTH } from "../lib/gazette.js";

export const FORMAT_SIZES = { "5v5": 5, "7v7": 7, "9v9": 9, "11v11": 11 };
const BREAKDOWN_COUNTS = { quarters: 4, halves: 2 };
const BREAKDOWN_LABELS = {
  quarters: ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"],
  halves: ["1st Half", "2nd Half"],
};
const POSITION_GROUP = {
  GK: "gk",
  RB: "def", CB: "def", LB: "def",
  RM: "mid", CM: "mid", LM: "mid",
  RW: "atk", ST: "atk", LW: "atk",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function shortLabel(name) {
  const parts = (name || "?").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}`;
}

export function buildSegments(breakdown) {
  const count = BREAKDOWN_COUNTS[breakdown];
  const labels = BREAKDOWN_LABELS[breakdown];
  return Array.from({ length: count }).map((_, i) => ({ id: uid(), label: labels[i], playerIds: [], positions: {}, notes: "", goals: {} }));
}

function autoLayoutPositions(selectedIds, players) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const ordered = selectedIds.map((id) => byId[id]).filter(Boolean);

  let gk = ordered.find((p) => POSITION_GROUP[p.position] === "gk");
  if (!gk && ordered.length) gk = ordered[0];

  const rest = ordered.filter((p) => p.id !== gk?.id);
  const lines = { def: [], mid: [], atk: [] };
  rest.forEach((p) => {
    const group = POSITION_GROUP[p.position] === "gk" ? "def" : POSITION_GROUP[p.position] || "mid";
    lines[group].push(p);
  });

  const positions = {};
  if (gk) positions[gk.id] = { x: 8, y: 33 };

  const lineX = { def: 28, mid: 52, atk: 76 };
  Object.entries(lines).forEach(([group, arr]) => {
    const spacing = 58 / (arr.length + 1);
    arr.forEach((p, i) => {
      positions[p.id] = { x: lineX[group], y: 8 + spacing * (i + 1) };
    });
  });

  return positions;
}

function MatchDayPitch({ segment, players, formatSize, editable, onToggleSelection, onMovePlayer, onNotesChange, onGoalChange }) {
  const svgRef = useRef(null);
  const [picking, setPicking] = useState(false);
  const [dragId, setDragId] = useState(null);

  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const onPitch = segment.playerIds.map((id) => byId[id]).filter(Boolean);
  const subs = players.filter((p) => !segment.playerIds.includes(p.id));
  const goals = segment.goals || {};

  const getPoint = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(64, ((e.clientY - rect.top) / rect.height) * 66));
    return { x, y };
  };

  const handlePointerMove = (e) => {
    if (!dragId) return;
    onMovePlayer(segment.id, dragId, getPoint(e));
  };
  const handlePointerUp = () => setDragId(null);

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg tracking-wide">{segment.label}</h3>
        <span className="text-xs" style={{ color: "var(--muted)" }}>{onPitch.length}/{formatSize} selected</span>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 100 66"
        className="w-full mb-3"
        style={{
          aspectRatio: "3/2",
          background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 40px, rgba(0,0,0,0.02) 40px 80px), linear-gradient(180deg, #168a3f, #136b34)",
          border: "2px solid rgba(255,255,255,0.35)",
          borderRadius: 6,
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect x="1" y="1" width="98" height="64" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <line x1="50" y1="1" x2="50" y2="65" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <circle cx="50" cy="33" r="9" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <rect x="1" y="18" width="10" height="30" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <rect x="89" y="18" width="10" height="30" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />

        {onPitch.map((p) => {
          const pos = segment.positions[p.id] || { x: 50, y: 33 };
          return (
            <g
              key={p.id}
              style={{ cursor: editable ? "grab" : "default" }}
              onPointerDown={(e) => {
                if (!editable) return;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setDragId(p.id);
              }}
            >
              <text x={pos.x} y={pos.y - 3.5} textAnchor="middle" fontSize="3.2" fill="white" fontWeight="700">{shortLabel(p.name)}</text>
              <circle cx={pos.x} cy={pos.y} r="3.4" fill="#2E7CF6" stroke="white" strokeWidth="0.5" />
            </g>
          );
        })}
      </svg>

      {editable && (
        <button className="btn-ghost w-full py-2 rounded-lg text-sm mb-3" onClick={() => setPicking((v) => !v)}>
          {picking ? "Close" : "Select players"}
        </button>
      )}

      {picking && editable && (
        <div className="glass-card p-3 mb-3 max-h-64 overflow-y-auto space-y-1.5">
          {players.map((p) => {
            const selected = segment.playerIds.includes(p.id);
            const atLimit = !selected && segment.playerIds.length >= formatSize;
            return (
              <button
                key={p.id}
                className="w-full flex items-center gap-2 p-2 rounded-lg text-left disabled:opacity-35"
                style={{ background: selected ? "rgba(46,124,246,0.18)" : "transparent" }}
                disabled={atLimit}
                onClick={() => onToggleSelection(segment.id, p.id)}
              >
                <span className="text-sm flex-1">{p.name || "Unnamed"}</span>
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>#{p.number || "—"} · {p.position}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Substitutes</div>
      {subs.length === 0 ? (
        <div className="text-sm mb-3" style={{ color: "var(--muted)" }}>None</div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {subs.map((p) => (
            <span key={p.id} className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              {p.name || "Unnamed"} {p.number ? `#${p.number}` : ""}
            </span>
          ))}
        </div>
      )}

      {onPitch.length > 0 && (
        <div className="mb-3">
          <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>Goals this {segment.label.toLowerCase()}</div>
          <div className="space-y-1.5">
            {onPitch.map((p) => {
              const count = goals[p.id] || 0;
              return (
                <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-sm flex-1">{p.name || "Unnamed"}</span>
                  {editable ? (
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-ghost w-6 h-6 rounded-full flex items-center justify-center text-sm disabled:opacity-30"
                        disabled={count === 0}
                        onClick={() => onGoalChange(segment.id, p.id, Math.max(0, count - 1))}
                      >
                        −
                      </button>
                      <span className="font-mono text-sm w-4 text-center">{count}</span>
                      <button
                        className="btn-ghost w-6 h-6 rounded-full flex items-center justify-center text-sm"
                        onClick={() => onGoalChange(segment.id, p.id, count + 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    count > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(212,175,55,0.18)", color: "#f1d97a" }}>
                        {count} {count === 1 ? "goal" : "goals"}
                      </span>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Comments</label>
        <textarea
          className="input-dark w-full mt-1 min-h-[60px]"
          placeholder={editable ? `Notes for this ${segment.label.toLowerCase()}…` : "No comments added yet."}
          value={segment.notes || ""}
          disabled={!editable}
          onChange={(e) => onNotesChange(segment.id, e.target.value)}
        />
      </div>
    </div>
  );
}

// ---------- Gazette (newspaper article) preview + download ----------
export function GazetteView({ html, fileName }) {
  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth || GAZETTE_WIDTH;
      setZoom(Math.min(1, w / GAZETTE_WIDTH));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const downloadPng = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadGazettePng(html, fileName);
    } catch (e) {
      setError(e?.message || "Couldn't create the download — try the PDF option instead.");
    }
    setBusy(false);
  };

  const savePdf = () => {
    if (!printGazette(html, fileName)) setError("Your browser blocked the pop-up — allow pop-ups and try again.");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button className="btn-accent px-4 py-2 rounded-lg text-sm flex items-center gap-2" onClick={downloadPng} disabled={busy}>
          <Download className="w-4 h-4" /> {busy ? "Preparing…" : "Download article"}
        </button>
        <button className="btn-ghost px-4 py-2 rounded-lg text-sm flex items-center gap-2" onClick={savePdf}>
          <Printer className="w-4 h-4" /> Save as PDF / print
        </button>
      </div>
      {error && <p className="text-sm mb-2" style={{ color: "#f28f8a" }}>{error}</p>}
      <div ref={wrapRef} style={{ width: "100%", overflow: "hidden" }}>
        <div style={{ zoom }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

const AWARD_DEFS = [
  { key: "captain", label: "Captain", short: "C" },
  { key: "potm", label: "Player of the match", short: "★" },
  { key: "parentsPotm", label: "Parents' player of the match", short: "P★" },
];

export default function MatchDayView({ matchdayId, teamId, teamName = "Team", editable }) {
  const [matchday, setMatchday] = useState(null);
  const [players, setPlayers] = useState([]);
  const [event, setEvent] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSquad, setEditingSquad] = useState(false);
  const [activeAward, setActiveAward] = useState(null);
  const [score, setScore] = useState({ our: "", their: "" });
  const [draft, setDraft] = useState({ headline: "", body: "" });
  const [publishing, setPublishing] = useState(false);
  const [reportError, setReportError] = useState("");
  const saveTimer = useRef(null);
  const club = useClubForTeam(teamId);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [{ data: md }, { data: pl }, { data: rep }] = await Promise.all([
        supabase.from("matchdays").select("*").eq("id", matchdayId).single(),
        supabase.from("players").select("*").eq("team_id", teamId),
        supabase.from("match_reports").select("*").eq("matchday_id", matchdayId).maybeSingle(),
      ]);
      let ev = null;
      if (md?.event_id) {
        const { data } = await supabase.from("calendar_events").select("*").eq("id", md.event_id).maybeSingle();
        ev = data;
      }
      const normalized = md
        ? { ...md, awards: md.awards || {}, segments: (md.segments || []).map((s) => ({ notes: "", goals: {}, ...s })) }
        : { format: "7v7", breakdown: "quarters", segments: buildSegments("quarters"), squad: null, awards: {} };
      setMatchday(normalized);
      setPlayers(pl || []);
      setEvent(ev);
      setReport(rep || null);
      setScore({ our: ev?.our_score ?? "", their: ev?.their_score ?? "" });
      setDraft({ headline: rep?.headline || "", body: rep?.body || "" });
      setLoading(false);
    })();
  }, [matchdayId, teamId]);

  const persist = (next) => {
    setMatchday(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase
        .from("matchdays")
        .update({ format: next.format, breakdown: next.breakdown, segments: next.segments, squad: next.squad ?? null, awards: next.awards || {} })
        .eq("id", matchdayId);
      setSaving(false);
    }, 400);
  };

  // ----- squad -----
  const squadIds = matchday?.squad ?? players.map((p) => p.id);
  const squadPlayers = players
    .filter((p) => squadIds.includes(p.id))
    .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));

  const toggleSquad = (playerId) => {
    const inSquad = squadIds.includes(playerId);
    const nextSquad = inSquad ? squadIds.filter((id) => id !== playerId) : [...squadIds, playerId];
    let next = { ...matchday, squad: nextSquad };
    if (inSquad) {
      next.segments = matchday.segments.map((s) => {
        const positions = { ...s.positions };
        delete positions[playerId];
        return { ...s, playerIds: s.playerIds.filter((id) => id !== playerId), positions };
      });
      const awards = { ...matchday.awards };
      let awardsChanged = false;
      Object.keys(awards).forEach((k) => {
        if (awards[k] === playerId) {
          awards[k] = null;
          awardsChanged = true;
        }
      });
      next.awards = awards;
      if (awardsChanged) afterAwardsChange(matchday.awards, awards);
    }
    persist(next);
  };

  // ----- awards -----
  // Mirrors the awards into each player's weekly stats entry for this match,
  // so they show on the player profile (and in the club and parent views).
  const syncAwardsToStats = async (prev, next) => {
    if (!event) return;
    const ids = new Set([...Object.values(prev || {}), ...Object.values(next || {})].filter(Boolean));
    await Promise.all(
      Array.from(ids).map(async (pid) => {
        const { data: row } = await supabase.from("players").select("stats").eq("id", pid).maybeSingle();
        if (!row) return;
        const stats = Array.isArray(row.stats) ? [...row.stats] : [];
        const flags = {
          captain: next?.captain === pid,
          potm: next?.potm === pid,
          parentsPotm: next?.parentsPotm === pid,
        };
        let idx = findStatIndex(stats, event);
        if (idx < 0) {
          if (!flags.captain && !flags.potm && !flags.parentsPotm) return;
          stats.unshift({ id: Math.random().toString(36).slice(2, 10), eventId: event.id, date: event.date, opponent: event.opponent || "", matchMinutes: 0, minutes: 0, goals: 0, tackles: 0, saves: 0 });
          idx = 0;
        }
        stats[idx] = { ...stats[idx], eventId: event.id, ...flags };
        await supabase.from("players").update({ stats }).eq("id", pid);
      })
    );
  };

  const afterAwardsChange = async (prev, next) => {
    await syncAwardsToStats(prev, next);
    if (report) {
      await supabase.from("match_reports").update({ awards: next, updated_at: new Date().toISOString() }).eq("matchday_id", matchdayId);
      setReport((r) => (r ? { ...r, awards: next } : r));
    }
  };

  const assignAward = (playerId) => {
    if (!editable || !activeAward) return;
    const prev = matchday.awards || {};
    const next = { ...prev, [activeAward]: prev[activeAward] === playerId ? null : playerId };
    persist({ ...matchday, awards: next });
    afterAwardsChange(prev, next);
  };

  // ----- score -----
  const saveScore = async (nextScore = score) => {
    if (!event) return;
    const our = nextScore.our === "" ? null : Number(nextScore.our);
    const their = nextScore.their === "" ? null : Number(nextScore.their);
    setSaving(true);
    await supabase.from("calendar_events").update({ our_score: our, their_score: their }).eq("id", event.id);
    setEvent({ ...event, our_score: our, their_score: their });
    setSaving(false);
  };

  // ----- pitches -----
  const setBreakdown = (breakdown) => {
    persist({ ...matchday, breakdown, segments: buildSegments(breakdown) });
  };
  const setFormat = (format) => {
    persist({ ...matchday, format, segments: matchday.segments.map((s) => ({ ...s, playerIds: [], positions: {} })) });
  };

  const toggleSelection = (segmentId, playerId) => {
    const formatSize = FORMAT_SIZES[matchday.format];
    const segments = matchday.segments.map((s) => {
      if (s.id !== segmentId) return s;
      const already = s.playerIds.includes(playerId);
      let playerIds;
      if (already) playerIds = s.playerIds.filter((id) => id !== playerId);
      else {
        if (s.playerIds.length >= formatSize) return s;
        playerIds = [...s.playerIds, playerId];
      }
      return { ...s, playerIds, positions: autoLayoutPositions(playerIds, players) };
    });
    persist({ ...matchday, segments });
  };

  const movePlayer = (segmentId, playerId, pos) => {
    const segments = matchday.segments.map((s) =>
      s.id !== segmentId ? s : { ...s, positions: { ...s.positions, [playerId]: pos } }
    );
    persist({ ...matchday, segments });
  };

  const setNotes = (segmentId, notes) => {
    const segments = matchday.segments.map((s) => (s.id !== segmentId ? s : { ...s, notes }));
    persist({ ...matchday, segments });
  };

  const setGoal = (segmentId, playerId, count) => {
    const segments = matchday.segments.map((s) =>
      s.id !== segmentId ? s : { ...s, goals: { ...(s.goals || {}), [playerId]: count } }
    );
    persist({ ...matchday, segments });
  };

  // ----- match report -----
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const awards = matchday?.awards || {};

  const gazetteHtml = (rep, body, headline) =>
    buildGazetteHtml({
      teamName,
      clubName: club?.name,
      clubLogo: club?.logo_url,
      headline,
      body,
      date: event?.date,
      opponent: event?.opponent,
      ourScore: event?.our_score,
      theirScore: event?.their_score,
      captain: playersById[(rep?.awards || awards).captain],
      potm: playersById[(rep?.awards || awards).potm],
      parentsPotm: playersById[(rep?.awards || awards).parentsPotm],
    });

  const publish = async () => {
    if (!draft.body.trim()) {
      setReportError("Write the match report first.");
      return;
    }
    setPublishing(true);
    setReportError("");
    const row = {
      matchday_id: matchdayId,
      team_id: teamId,
      event_id: matchday.event_id || event?.id || null,
      headline: draft.headline.trim() || null,
      body: draft.body,
      awards,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("match_reports").upsert(row).select().single();
    setPublishing(false);
    if (error) {
      setReportError(error.message);
      return;
    }
    setReport(data);
  };

  const unpublish = async () => {
    if (!confirm("Unpublish this report? Parents will no longer see it.")) return;
    await supabase.from("match_reports").delete().eq("matchday_id", matchdayId);
    setReport(null);
  };

  if (loading || !matchday) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  const formatSize = FORMAT_SIZES[matchday.format];
  const hasScore = event && event.our_score !== null && event.our_score !== undefined && event.their_score !== null && event.their_score !== undefined;
  const awardHolders = AWARD_DEFS.map((a) => ({ ...a, player: playersById[awards[a.key]] })).filter((a) => a.player);
  const reportChanged = report && (draft.body !== (report.body || "") || (draft.headline || "") !== (report.headline || ""));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl tracking-wide">Match Day</h1>
        {saving && <span className="text-xs" style={{ color: "var(--muted)" }}>Saving…</span>}
      </div>

      {/* Front page: result + awards at a glance */}
      <div className="glass-panel p-5 mb-6 text-center">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          {event?.date}{event?.time ? ` · ${event.time}` : ""}{event?.location ? ` · ${event.location}` : ""}
        </div>
        <div className="font-display text-xl mt-1">
          {teamName} {hasScore ? <span style={{ color: "var(--gold-light)" }}>{event.our_score} – {event.their_score}</span> : "v"} {event?.opponent || "TBC"}
        </div>
        {awardHolders.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {awardHolders.map((a) => (
              <span key={a.key} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(212,175,55,0.18)", color: "#f1d97a" }}>
                {a.label}: {a.player.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Score entry (above the squad) */}
      <div className="glass-panel p-4 mb-6">
        <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Final score</div>
        {!event ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>This match isn't linked to a calendar event.</p>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium">{teamName}</span>
            <input
              type="number" min="0" inputMode="numeric"
              className="input-dark w-16 text-center font-mono text-lg"
              value={score.our}
              disabled={!editable}
              onChange={(e) => setScore({ ...score, our: e.target.value })}
              onBlur={() => saveScore()}
            />
            <span className="font-mono">–</span>
            <input
              type="number" min="0" inputMode="numeric"
              className="input-dark w-16 text-center font-mono text-lg"
              value={score.their}
              disabled={!editable}
              onChange={(e) => setScore({ ...score, their: e.target.value })}
              onBlur={() => saveScore()}
            />
            <span className="font-medium">{event.opponent || "Opposition"}</span>
          </div>
        )}
      </div>

      {players.length === 0 ? (
        <div className="glass-panel p-10 text-center mb-8" style={{ color: "var(--muted)" }}>Add players on the Team page first.</div>
      ) : (
        <div className="glass-panel p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Squad ({squadPlayers.length})
            </div>
            {editable && (
              <button className="btn-ghost px-3 py-1 rounded-lg text-xs" onClick={() => setEditingSquad((v) => !v)}>
                {editingSquad ? "Done" : "Edit squad"}
              </button>
            )}
          </div>

          {editable && editingSquad && (
            <div className="glass-card p-3 mb-3 max-h-64 overflow-y-auto space-y-1">
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>Tick everyone available for this match.</p>
              {players.map((p) => (
                <label key={p.id} className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={squadIds.includes(p.id)} onChange={() => toggleSquad(p.id)} />
                  <span className="text-sm flex-1">{p.name || "Unnamed"}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>#{p.number || "—"} · {p.position}</span>
                </label>
              ))}
            </div>
          )}

          {editable && (
            <div className="mb-3">
              <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>
                Awards — pick one, then tap the player who earned it (tap again to remove).
              </div>
              <div className="flex flex-wrap gap-2">
                {AWARD_DEFS.map((a) => (
                  <button
                    key={a.key}
                    className={`${activeAward === a.key ? "btn-accent" : "btn-ghost"} px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5`}
                    onClick={() => setActiveAward(activeAward === a.key ? null : a.key)}
                  >
                    <Star className="w-3 h-3" /> {a.label}
                  </button>
                ))}
              </div>
              {activeAward && (
                <div className="text-xs mt-1.5" style={{ color: "var(--gold-light)" }}>
                  Now tap a player below for “{AWARD_DEFS.find((a) => a.key === activeAward).label}”.
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {squadPlayers.map((p) => {
              const held = AWARD_DEFS.filter((a) => awards[a.key] === p.id);
              const clickable = editable && !!activeAward;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => assignAward(p.id)}
                  className="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5"
                  style={{
                    background: held.length ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.06)",
                    outline: clickable ? "1px dashed rgba(255,255,255,0.35)" : "none",
                    cursor: clickable ? "pointer" : "default",
                  }}
                >
                  <span className="font-mono" style={{ color: "var(--accent)" }}>#{p.number || "—"}</span>
                  {p.name || "Unnamed"} <span style={{ color: "var(--muted)" }}>· {p.position}</span>
                  {held.map((a) => (
                    <span key={a.key} className="px-1.5 rounded-full font-bold" style={{ background: "#d4af37", color: "#0b1223" }} title={a.label}>{a.short}</span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="glass-panel p-4">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Match times</label>
          <select
            className="w-full mt-1 rounded-lg px-2.5 py-2"
            style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
            value={matchday.breakdown}
            disabled={!editable}
            onChange={(e) => setBreakdown(e.target.value)}
          >
            <option value="quarters">Quarters (4)</option>
            <option value="halves">Halves (2)</option>
          </select>
        </div>
        <div className="glass-panel p-4">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Format</label>
          <select
            className="w-full mt-1 rounded-lg px-2.5 py-2"
            style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
            value={matchday.format}
            disabled={!editable}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="5v5">5 v 5</option>
            <option value="7v7">7 v 7</option>
            <option value="9v9">9 v 9</option>
            <option value="11v11">11 v 11</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {matchday.segments.map((segment) => (
          <MatchDayPitch
            key={segment.id}
            segment={segment}
            players={squadPlayers}
            formatSize={formatSize}
            editable={editable}
            onToggleSelection={toggleSelection}
            onMovePlayer={movePlayer}
            onNotesChange={setNotes}
            onGoalChange={setGoal}
          />
        ))}
      </div>

      {/* Match report -> Gazette */}
      {editable && (
        <div className="glass-panel p-5 mt-10">
          <h2 className="font-display text-xl mb-1 flex items-center gap-2">Match report</h2>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Write the report, then publish it. It becomes the “{teamName} Gazette” article — with the score, the club
            emblem and photos of the Player of the Match and Parents' Player of the Match (if their parents have added photos).
            Parents only see the match once this is published.
          </p>

          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Headline (optional)</label>
          <input
            className="input-dark w-full mt-1 mb-3"
            placeholder={event ? `${teamName} ${hasScore ? `${event.our_score}–${event.their_score}` : "v"} ${event.opponent || "Opposition"}` : "Headline"}
            value={draft.headline}
            onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
          />
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Report</label>
          <textarea
            className="input-dark w-full mt-1 min-h-[180px]"
            placeholder="How did the match go? Leave a blank line between paragraphs."
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          {reportError && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{reportError}</p>}
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <button className="btn-accent px-5 py-2.5 rounded-lg" onClick={publish} disabled={publishing}>
              {publishing ? "Publishing…" : report ? (reportChanged ? "Update published report" : "Re-publish") : "Publish report"}
            </button>
            {report && (
              <button className="btn-ghost px-4 py-2.5 rounded-lg text-sm" onClick={unpublish}>Unpublish</button>
            )}
            {report && !reportChanged && <span className="text-xs" style={{ color: "#6fe39a" }}>Published — parents can read it.</span>}
          </div>
        </div>
      )}

      {report && (
        <div className="mt-8">
          <h2 className="font-display text-xl mb-3">The article</h2>
          <GazetteView
            html={gazetteHtml(report, report.body, report.headline)}
            fileName={`${teamName} Gazette${event?.date ? " " + event.date : ""}`}
          />
        </div>
      )}
    </div>
  );
}
