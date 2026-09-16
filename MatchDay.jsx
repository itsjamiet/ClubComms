import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

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

export default function MatchDayView({ matchdayId, teamId, editable }) {
  const [matchday, setMatchday] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("matchdays").select("*").eq("id", matchdayId).single(),
      supabase.from("players").select("*").eq("team_id", teamId),
    ]).then(([{ data: md }, { data: pl }]) => {
      const normalized = md
        ? { ...md, segments: (md.segments || []).map((s) => ({ notes: "", goals: {}, ...s })) }
        : { format: "7v7", breakdown: "quarters", segments: buildSegments("quarters") };
      setMatchday(normalized);
      setPlayers(pl || []);
      setLoading(false);
    });
  }, [matchdayId, teamId]);

  const persist = (next) => {
    setMatchday(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("matchdays").update({ format: next.format, breakdown: next.breakdown, segments: next.segments }).eq("id", matchdayId);
      setSaving(false);
    }, 400);
  };

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

  if (loading || !matchday) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  const formatSize = FORMAT_SIZES[matchday.format];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl tracking-wide">Match Day</h1>
        {saving && <span className="text-xs" style={{ color: "var(--muted)" }}>Saving…</span>}
      </div>

      {players.length === 0 ? (
        <div className="glass-panel p-10 text-center mb-8" style={{ color: "var(--muted)" }}>Add players on the Team page first.</div>
      ) : (
        <div className="glass-panel p-4 mb-6">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Squad</div>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <span key={p.id} className="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <span className="font-mono" style={{ color: "var(--accent)" }}>#{p.number || "—"}</span>
                {p.name || "Unnamed"} <span style={{ color: "var(--muted)" }}>· {p.position}</span>
              </span>
            ))}
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
            players={players}
            formatSize={formatSize}
            editable={editable}
            onToggleSelection={toggleSelection}
            onMovePlayer={movePlayer}
            onNotesChange={setNotes}
            onGoalChange={setGoal}
          />
        ))}
      </div>
    </div>
  );
}

