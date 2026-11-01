import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { toDateString } from "../lib/utils.js";

// Match Day front page, laid out like the Calendar: next match first, then the
// matches after it; "Previous" shows older matches (most recent first).
// matches: [{ id, date, time, location, opponent, our_score, their_score, ... }]
let lastView = "upcoming"; // remembered so "Back to match days" returns to the list you were on

export default function MatchList({ matches, teamName, loading, intro, emptyText, onOpen, showScore = () => true, extra }) {
  const [view, setViewState] = useState(lastView);
  const setView = (v) => { lastView = v; setViewState(v); };
  const today = toDateString(new Date());
  const upcoming = matches.filter((m) => m.date >= today).slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const previous = matches.filter((m) => m.date < today).slice().sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
  const shown = view === "previous" ? previous : upcoming;

  const card = (m) => {
    const hasScore = m.our_score !== null && m.our_score !== undefined && m.their_score !== null && m.their_score !== undefined;
    return (
      <button key={m.id} className="glass-card w-full flex items-center gap-3 p-4 text-left" onClick={() => onOpen(m)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "#ffffff" }}>
              {teamName} vs {m.opponent || "TBC"}
            </span>
            {hasScore && showScore(m) && (
              <span style={{ fontSize: "1.3rem", fontWeight: 600, color: "#ffffff" }}>{m.our_score} - {m.their_score}</span>
            )}
          </div>
          <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {m.date}{m.time ? ` · ${m.time}` : ""}{m.location ? ` · ${m.location}` : ""}
          </div>
          {extra && extra(m)}
        </div>
        <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: "var(--muted)" }} />
      </button>
    );
  };

  if (view === "previous") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button className="text-sm flex items-center gap-1 mb-6" style={{ color: "var(--muted)" }} onClick={() => setView("upcoming")}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to match days
        </button>
        <h1 className="font-display text-2xl tracking-wide mb-2">Previous Matches</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Matches move here automatically once their date has passed.</p>
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : shown.length === 0 ? (
          <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No past matches yet.</div>
        ) : (
          <div className="space-y-3">{shown.map(card)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="font-display text-2xl tracking-wide">Match Days</h1>
        <button className="btn-ghost px-4 py-2 rounded-lg text-sm" onClick={() => setView("previous")}>Previous</button>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>{intro}</p>
      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : shown.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>{emptyText}</div>
      ) : (
        <div className="space-y-3">{shown.map(card)}</div>
      )}
    </div>
  );
}
