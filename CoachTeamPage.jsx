import { useEffect, useState } from "react";
import { Shield, LogOut, Plus, Users, ArrowLeft, Camera, Trash2, Circle, ArrowUpRight, Eraser, Pencil, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import MatchDayView, { buildSegments } from "./MatchDay.jsx";
import DocumentsView from "./Documents.jsx";
import TrainingSessionView, { Quadrant, TOOLS, defaultPitch } from "./TrainingSession.jsx";
import ClubCalendarTab from "./ClubCalendar.jsx";
import DropdownMenu, { DropdownItem } from "../components/DropdownMenu.jsx";

const POSITIONS = ["Any", "GK", "RB", "CB", "LB", "RM", "CM", "LM", "RW", "ST", "LW"];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Resizes and compresses a photo before upload. iPhone photos are often
// several MB (sometimes 10+ MB) and can be in HEIC format -- both can
// cause the upload to silently fail. This shrinks the image and always
// re-encodes it as a JPEG, which fixes both problems at once.
function resizeImage(file, maxDimension = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

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

function InviteParent({ teamId, playerId }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("invites")
      .insert({ team_id: teamId, role: "parent", player_id: playerId, created_by: userData.user.id })
      .select()
      .single();
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setLink(`${window.location.origin}${window.location.pathname}?invite=${data.id}`);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel p-6 mt-6">
      <h2 className="font-display text-lg mb-1">Parents</h2>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Generate a link for this player's parent — they'll be linked to this
        child specifically, not the whole team.
      </p>
      {!link ? (
        <button className="btn-accent px-4 py-2 rounded-lg text-sm" onClick={generateInvite} disabled={loading}>
          {loading ? "Generating…" : "Generate parent invite link"}
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input-dark flex-1 font-mono text-xs" value={link} readOnly onFocus={(e) => e.target.select()} />
          <button className="btn-ghost px-4 py-2 rounded-lg text-sm flex-shrink-0" onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}
      {error && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{error}</p>}
    </div>
  );
}

const PLAN_STATUSES = [
  { id: "needs_practice", label: "Needs practice", color: "#E8433D" },
  { id: "improving", label: "Improving", color: "#F2A31D" },
  { id: "mastered", label: "Mastered", color: "#1FB65A" },
];

// Formats a Date using its LOCAL calendar day, never toISOString() (which
// converts to UTC first and can roll the date back a day for anyone in a
// timezone ahead of UTC, e.g. UK British Summer Time).
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function DrillEditor({ drill, onUpdate, onRemove }) {
  const [toolId, setToolId] = useState("blue");
  const tool = TOOLS.find((t) => t.id === toolId) || null;

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-3 mb-3">
        <input
          className="input-dark flex-1 font-display text-base"
          placeholder="Drill title (e.g. Wall pass triangles)"
          value={drill.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
        <button className="opacity-50 hover:opacity-100 flex-shrink-0" onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`btn-ghost px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 ${toolId === t.id ? "ring-2 ring-white" : ""}`}
            onClick={() => setToolId(t.id)}
          >
            {t.kind === "dot" && <Circle className="w-3 h-3" fill={t.color} stroke={t.color} />}
            {t.kind === "arrow" && <ArrowUpRight className="w-3 h-3" />}
            {t.kind === "drag-arrow" && <ArrowUpRight className="w-3 h-3" strokeWidth={3} />}
            {t.kind === "erase" && <Eraser className="w-3 h-3" />}
            {t.label}
          </button>
        ))}
      </div>

      <Quadrant
        index={drill.id}
        quadrant={drill.pitch || defaultPitch()}
        setQuadrant={(val) => onUpdate({ pitch: val })}
        tool={tool}
        editable={true}
        label="Drill pitch"
        showNotes={false}
      />

      <div className="mt-3">
        <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Details</label>
        <textarea
          className="input-dark w-full mt-1 min-h-[80px]"
          placeholder="Explain how the drill works, coaching points, timing, etc."
          value={drill.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />
      </div>
    </div>
  );
}

function TrainingPlanEditor({ playerId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openDrillsRowId, setOpenDrillsRowId] = useState(null);

  useEffect(() => {
    supabase
      .from("training_plans")
      .select("rows")
      .eq("player_id", playerId)
      .maybeSingle()
      .then(({ data }) => {
        setRows(data?.rows?.length ? data.rows : Array.from({ length: 5 }, () => ({ id: uid(), title: "", content: "", status: "needs_practice", drills: [] })));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const save = async (nextRows) => {
    setSaving(true);
    setError("");
    const { error } = await supabase
      .from("training_plans")
      .upsert({ player_id: playerId, rows: nextRows }, { onConflict: "player_id" });
    setSaving(false);
    if (error) setError(error.message);
  };

  const updateRow = (id, patch) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRows(next);
  };

  const removeRow = (id) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    save(next);
  };

  const addRow = () => {
    const next = [...rows, { id: uid(), title: "", content: "", status: "needs_practice", drills: [] }];
    setRows(next);
  };

  const addDrill = (rowId) => {
    const next = rows.map((r) =>
      r.id === rowId ? { ...r, drills: [...(r.drills || []), { id: uid(), title: "", description: "", pitch: defaultPitch() }] } : r
    );
    setRows(next);
    save(next);
  };

  const updateDrill = (rowId, drillId, patch) => {
    const next = rows.map((r) =>
      r.id !== rowId ? r : { ...r, drills: (r.drills || []).map((d) => (d.id === drillId ? { ...d, ...patch } : d)) }
    );
    setRows(next);
  };

  const removeDrill = (rowId, drillId) => {
    const next = rows.map((r) => (r.id !== rowId ? r : { ...r, drills: (r.drills || []).filter((d) => d.id !== drillId) }));
    setRows(next);
    save(next);
  };

  return (
    <div className="glass-panel p-6 mt-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg">Training plan</h2>
        <button className="btn-accent px-3 py-1.5 rounded-lg text-xs" onClick={() => save(rows)} disabled={saving}>
          {saving ? "Saving…" : "Save plan"}
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Only this player's own parent can see this — everything else on the team
        stays visible to all parents.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const status = PLAN_STATUSES.find((s) => s.id === row.status) || PLAN_STATUSES[0];
            return (
              <div key={row.id} className="glass-card p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    className="input-dark flex-1 min-w-0"
                    placeholder="Title (e.g. First touch)"
                    value={row.title}
                    onChange={(e) => updateRow(row.id, { title: e.target.value })}
                  />
                  <input
                    className="input-dark flex-[2] min-w-0"
                    placeholder="Details / notes"
                    value={row.content}
                    onChange={(e) => updateRow(row.id, { content: e.target.value })}
                  />
                  <button className="opacity-50 hover:opacity-100 flex-shrink-0" onClick={() => removeRow(row.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    {PLAN_STATUSES.map((s) => {
                      const active = status.id === s.id;
                      return (
                        <button
                          key={s.id}
                          className="text-xs px-2.5 py-1 rounded-full"
                          style={{
                            background: active ? s.color : "rgba(255,255,255,0.06)",
                            color: active ? "#0b1223" : "var(--muted)",
                            fontWeight: active ? 700 : 400,
                          }}
                          onClick={() => updateRow(row.id, { status: s.id })}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="text-xs"
                    style={{ color: "var(--accent)" }}
                    onClick={() => setOpenDrillsRowId(openDrillsRowId === row.id ? null : row.id)}
                  >
                    Improvement drills {(row.drills || []).length > 0 ? `(${row.drills.length})` : ""}
                  </button>
                </div>

                {openDrillsRowId === row.id && (
                  <div className="space-y-4 pt-2">
                    {(row.drills || []).map((drill) => (
                      <DrillEditor
                        key={drill.id}
                        drill={drill}
                        onUpdate={(patch) => updateDrill(row.id, drill.id, patch)}
                        onRemove={() => removeDrill(row.id, drill.id)}
                      />
                    ))}
                    <button className="btn-accent w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2" onClick={() => addDrill(row.id)}>
                      <Plus className="w-4 h-4" /> Add drill
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button className="btn-ghost w-full py-2 rounded-lg text-sm" onClick={addRow}>
            + Add row
          </button>
        </div>
      )}
      {error && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{error}</p>}
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

function useAttendanceStats(teamId, playerId) {
  const [attendance, setAttendance] = useState(null);
  useEffect(() => {
    if (!teamId || !playerId) return;
    const todayStr = toDateString(new Date());
    (async () => {
      const { data: events } = await supabase.from("calendar_events").select("id, type, date").eq("team_id", teamId).lt("date", todayStr);
      if (!events || events.length === 0) {
        setAttendance({ trainingTotal: 0, trainingAttended: 0, matchTotal: 0, matchAttended: 0 });
        return;
      }
      const eventIds = events.map((e) => e.id);
      const { data: rsvps } = await supabase.from("rsvps").select("event_id, attended").eq("player_id", playerId).in("event_id", eventIds);
      const attendedSet = new Set((rsvps || []).filter((r) => r.attended).map((r) => r.event_id));
      const trainingEvents = events.filter((e) => e.type === "training");
      const matchEvents = events.filter((e) => e.type === "match");
      setAttendance({
        trainingTotal: trainingEvents.length,
        trainingAttended: trainingEvents.filter((e) => attendedSet.has(e.id)).length,
        matchTotal: matchEvents.length,
        matchAttended: matchEvents.filter((e) => attendedSet.has(e.id)).length,
      });
    })();
  }, [teamId, playerId]);
  return attendance;
}

function StatTotalsGrid({ stats, attendance }) {
  const t = statTotals(stats);
  const boxes = [];
  if (attendance) {
    boxes.push(
      { label: "Training sessions attended", value: `${attendance.trainingAttended}/${attendance.trainingTotal}` },
      { label: "Matches attended", value: `${attendance.matchAttended}/${attendance.matchTotal}` },
    );
  }
  boxes.push(
    { label: "Minutes played", value: t.minutesPct === null ? "—" : `${t.minutesPct}%` },
    { label: "Goals", value: t.goalsTotal },
    { label: "Saves", value: t.savesTotal },
    { label: "Tackles", value: t.tacklesTotal },
    { label: "Captain", value: t.captainTotal },
    { label: "Player of the match", value: t.potmTotal },
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {boxes.map((b) => (
        <div key={b.label} className="glass-card p-4">
          <div className="text-2xl font-mono">{b.value}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{b.label}</div>
        </div>
      ))}
    </div>
  );
}

function WeeklyStatsEditor({ playerId, teamId }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("players").select("stats").eq("id", playerId).single().then(({ data }) => {
      setStats(data?.stats || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const persist = async (next) => {
    setSaving(true);
    setError("");
    const { error } = await supabase.from("players").update({ stats: next }).eq("id", playerId);
    setSaving(false);
    if (error) setError(error.message);
  };

  const addWeek = () => {
    const next = [
      { id: uid(), date: toDateString(new Date()), opponent: "", matchMinutes: 0, minutes: 0, goals: 0, tackles: 0, saves: 0, captain: false, potm: false },
      ...stats,
    ];
    setStats(next);
    persist(next);
  };

  const updateStat = (id, patch) => {
    setStats((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const attendance = useAttendanceStats(teamId, playerId);

  const removeStat = (id) => {
    const next = stats.filter((x) => x.id !== id);
    setStats(next);
    persist(next);
  };

  return (
    <div className="glass-panel p-6 mt-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg">Weekly stats</h2>
        <div className="flex gap-2">
          <button className="btn-accent px-3 py-1.5 rounded-lg text-xs" onClick={() => persist(stats)} disabled={saving}>
            {saving ? "Saving…" : "Save stats"}
          </button>
          <button className="btn-ghost px-3 py-1.5 rounded-lg text-xs" onClick={addWeek}>+ Add this week</button>
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Visible to every parent on the team, not just this player's own parent.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
      ) : stats.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>No stats logged yet.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 mb-2">
          {stats.map((s) => (
            <div key={s.id} className="glass-card p-4 w-64 flex-shrink-0 relative">
              <button className="absolute top-2 right-2 opacity-50 hover:opacity-100" onClick={() => removeStat(s.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <label className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Match date</label>
              <input type="date" className="input-dark w-full mb-2 mt-1 text-sm" value={s.date} onChange={(e) => updateStat(s.id, { date: e.target.value })} />
              <label className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Opponent</label>
              <input className="input-dark w-full mb-2 mt-1 text-sm" value={s.opponent} onChange={(e) => updateStat(s.id, { opponent: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Match mins</label>
                  <input type="number" className="input-dark w-full font-mono text-sm" placeholder="0" value={s.matchMinutes || ""} onChange={(e) => updateStat(s.id, { matchMinutes: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Mins played</label>
                  <input type="number" className="input-dark w-full font-mono text-sm" placeholder="0" value={s.minutes || ""} onChange={(e) => updateStat(s.id, { minutes: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Goals</label>
                  <input type="number" className="input-dark w-full font-mono text-sm" placeholder="0" value={s.goals || ""} onChange={(e) => updateStat(s.id, { goals: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Tackles</label>
                  <input type="number" className="input-dark w-full font-mono text-sm" placeholder="0" value={s.tackles || ""} onChange={(e) => updateStat(s.id, { tackles: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Saves</label>
                  <input type="number" className="input-dark w-full font-mono text-sm" placeholder="0" value={s.saves || ""} onChange={(e) => updateStat(s.id, { saves: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                  <input type="checkbox" checked={!!s.captain} onChange={(e) => updateStat(s.id, { captain: e.target.checked })} />
                  Captain
                </label>
                <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                  <input type="checkbox" checked={!!s.potm} onChange={(e) => updateStat(s.id, { potm: e.target.checked })} />
                  Player of the match
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="font-display text-base mb-2 mt-2">Stat totals</h3>
      <StatTotalsGrid stats={stats} attendance={attendance} />

      {error && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{error}</p>}
    </div>
  );
}

function PlayerDetail({ player, onBack, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    name: player.name || "",
    number: player.number || "",
    age: player.age || "",
    position: player.position || "GK",
  });
  const [photoUrl, setPhotoUrl] = useState(player.photo_url || "");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showInviteParent, setShowInviteParent] = useState(false);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    try {
      const url = await resizeImage(file);
      setPhotoUrl(url);
    } catch (err) {
      setPhotoError(err?.message || "Couldn't process that photo — try a different one.");
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { error } = await supabase
        .from("players")
        .update({ ...form, photo_url: photoUrl })
        .eq("id", player.id);
      if (error) {
        setError(error.message);
        return;
      }
      onSaved({ ...player, ...form, photo_url: photoUrl });
    } catch (err) {
      setError(err?.message || "Something went wrong saving — try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${player.name || "this player"}? This can't be undone.`)) return;
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) {
      setError(error.message);
      return;
    }
    onDeleted(player.id);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <button className="text-sm flex items-center gap-1" style={{ color: "var(--muted)" }} onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to team
        </button>
        <DropdownMenu>
          {({ close }) => (
            <>
              <DropdownItem onClick={() => { setShowInviteParent((v) => !v); close(); }}>
                {showInviteParent ? "Hide parent invite" : "Invite parent"}
              </DropdownItem>
              <DropdownItem onClick={() => { close(); remove(); }}>
                Remove player
              </DropdownItem>
            </>
          )}
        </DropdownMenu>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "#f28f8a" }}>{error}</p>}

      <div className="flex flex-col items-center mb-8">
        <label className="w-28 h-28 rounded-full relative group cursor-pointer overflow-hidden border-2 flex items-center justify-center" style={{ borderColor: "var(--accent)", background: "rgba(255,255,255,0.04)" }}>
          {photoUrl ? (
            <img src={photoUrl} alt={form.name} className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8" style={{ color: "var(--muted)" }} />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
            <Camera className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "white" }} />
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </label>
        {photoError && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{photoError}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-4">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Name</label>
          <input className="input-dark w-full mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="glass-panel p-4">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Number</label>
          <input type="number" className="input-dark w-full mt-1 font-mono" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        </div>
        <div className="glass-panel p-4">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Age</label>
          <input type="number" className="input-dark w-full mt-1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </div>
        <div className="glass-panel p-4">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Position</label>
          <select
            className="w-full mt-1 rounded-lg px-2.5 py-2"
            style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          >
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-accent px-5 py-2.5 rounded-lg" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {showInviteParent && <InviteParent teamId={player.team_id} playerId={player.id} />}

      <WeeklyStatsEditor playerId={player.id} teamId={player.team_id} />
    </div>
  );
}

function TeamRoster({ team, onOpenPlayer }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("players").select("*").eq("team_id", team.id);
    if (!error) setPlayers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const addPlayer = async () => {
    setError("");
    const { data, error } = await supabase
      .from("players")
      .insert({ team_id: team.id, name: "New Player", position: "Any" })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setPlayers((p) => [...p, data]);
    onOpenPlayer(data, load);
  };

  const sorted = sortByNumber(players);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 relative">
      <h1 className="font-display text-2xl tracking-wide mb-6">{team.name}</h1>

      {error && <p className="text-sm mb-4" style={{ color: "#f28f8a" }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>
          No players yet. Use the + button to add your first player.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {sorted.map((p) => (
            <PlayerCard key={p.id} player={p} onOpen={(player) => onOpenPlayer(player, load)} />
          ))}
        </div>
      )}

      <button
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full btn-accent flex items-center justify-center"
        onClick={addPlayer}
        title="Add player"
      >
        <Plus className="w-6 h-6" />
      </button>
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

function EventFields({ form, setForm }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Type</label>
          <select
            className="w-full mt-1 rounded-lg px-2.5 py-2"
            style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value, ...(e.target.value !== "match" ? { home_color: null, away_color: null } : {}) })}
          >
            <option value="training">Training</option>
            <option value="match">Match</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Title (optional)</label>
          <input className="input-dark w-full mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Date</label>
          <input type="date" className="input-dark w-full mt-1" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Time</label>
          <input type="time" className="input-dark w-full mt-1" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Location (address)</label>
          <input className="input-dark w-full mt-1" placeholder="e.g. Recreation Ground, Main St" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        {form.type === "match" && (
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Opponent</label>
            <input className="input-dark w-full mt-1" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
          </div>
        )}
      </div>

      {form.type === "match" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={form.home_color !== null}
                onChange={(e) => setForm({ ...form, home_color: e.target.checked ? "#2E7CF6" : null })}
              />
              Home strip
            </label>
            {form.home_color !== null && (
              <div className="flex items-center gap-2 mt-1">
                <KitIcon color={form.home_color} />
                <input type="color" value={form.home_color} onChange={(e) => setForm({ ...form, home_color: e.target.value })} className="w-10 h-9 rounded-lg border border-white/10 bg-transparent" />
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={form.away_color !== null}
                onChange={(e) => setForm({ ...form, away_color: e.target.checked ? "#E8433D" : null })}
              />
              Away strip
            </label>
            {form.away_color !== null && (
              <div className="flex items-center gap-2 mt-1">
                <KitIcon color={form.away_color} />
                <input type="color" value={form.away_color} onChange={(e) => setForm({ ...form, away_color: e.target.value })} className="w-10 h-9 rounded-lg border border-white/10 bg-transparent" />
              </div>
            )}
          </div>
        </div>
      )}

      {form.type === "match" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Score (us)</label>
            <input
              type="number"
              className="input-dark w-full mt-1 font-mono"
              placeholder="—"
              value={form.our_score ?? ""}
              onChange={(e) => setForm({ ...form, our_score: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Score (them)</label>
            <input
              type="number"
              className="input-dark w-full mt-1 font-mono"
              placeholder="—"
              value={form.their_score ?? ""}
              onChange={(e) => setForm({ ...form, their_score: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Notes</label>
        <input className="input-dark w-full mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </>
  );
}


function generateRecurringDates(startDateStr, interval) {
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);

  const dates = [];
  let current = new Date(start);
  let guard = 0;
  while (current <= end && guard < 60) {
    dates.push(toDateString(current));
    if (interval === "weekly") current.setDate(current.getDate() + 7);
    else if (interval === "biweekly") current.setDate(current.getDate() + 14);
    else if (interval === "monthly") current.setMonth(current.getMonth() + 1);
    else break;
    guard++;
  }
  return dates;
}

function EventForm({ teamId, onCreated, onCancel }) {
  const [form, setForm] = useState({ type: "training", title: "", date: "", time: "", location: "", opponent: "", notes: "", home_color: null, away_color: null, our_score: null, their_score: null, recurrence: "none" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const previewDates = form.type === "training" && form.recurrence !== "none" && form.date
    ? generateRecurringDates(form.date, form.recurrence)
    : null;

  const populateWeeklyStats = async (matchDate, opponent) => {
    const { data: teamPlayers } = await supabase.from("players").select("id, stats").eq("team_id", teamId);
    await Promise.all((teamPlayers || []).map((p) => {
      const newEntry = { id: uid(), date: matchDate, opponent: opponent || "", matchMinutes: 0, minutes: 0, goals: 0, tackles: 0, saves: 0, captain: false, potm: false };
      const nextStats = [newEntry, ...(p.stats || [])];
      return supabase.from("players").update({ stats: nextStats }).eq("id", p.id);
    }));
  };

  const save = async () => {
    if (!form.date) return;
    setSaving(true);
    setError("");
    const { recurrence, ...eventFields } = form;
    const isRecurring = form.type === "training" && recurrence !== "none";
    const groupId = isRecurring ? crypto.randomUUID() : null;

    const rows = isRecurring
      ? generateRecurringDates(form.date, recurrence).map((date) => ({ team_id: teamId, ...eventFields, date, recurrence_group_id: groupId }))
      : [{ team_id: teamId, ...eventFields, recurrence_group_id: null }];

    const { data, error } = await supabase.from("calendar_events").insert(rows).select();
    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    if (form.type === "match") {
      await populateWeeklyStats(form.date, form.opponent);
      const newEvent = data[0];
      if (newEvent) {
        await supabase.from("matchdays").insert({
          event_id: newEvent.id,
          team_id: teamId,
          format: "7v7",
          breakdown: "quarters",
          segments: buildSegments("quarters"),
        });
      }
    }

    setSaving(false);
    onCreated(data);
  };

  return (
    <div className="glass-panel p-5 mb-6 space-y-3">
      <EventFields form={form} setForm={setForm} />

      {form.type === "training" && (
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Repeats</label>
          <select
            className="w-full mt-1 rounded-lg px-2.5 py-2"
            style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
            value={form.recurrence}
            onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
          >
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
          {previewDates && (
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Creates {previewDates.length} sessions, rolling 3 months ahead from the date above.
            </p>
          )}
        </div>
      )}

      {form.type === "match" && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Saving this will add a blank week (with this date and opponent) to every player's stats — delete it for anyone who didn't play.
        </p>
      )}

      {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
      <div className="flex gap-2">
        <button className="btn-accent px-4 py-2 rounded-lg text-sm" onClick={save} disabled={saving || !form.date}>
          {saving ? "Saving…" : "Save event"}
        </button>
        <button className="btn-ghost px-4 py-2 rounded-lg text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function EventCard({ event, players, editable, ownChildIds, onDeleted, onUpdated, onReload }) {
  const [expanded, setExpanded] = useState(false);
  const [rsvps, setRsvps] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

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
    await supabase.from("rsvps").upsert({ event_id: event.id, player_id: playerId, status }, { onConflict: "event_id,player_id" });
    loadRsvps();
  };

  const toggleAttended = async (playerId, current) => {
    await supabase.from("rsvps").upsert({ event_id: event.id, player_id: playerId, attended: !current }, { onConflict: "event_id,player_id" });
    loadRsvps();
  };

  const deleteEvent = async () => {
    if (!confirm("Delete this event?")) return;
    await supabase.from("calendar_events").delete().eq("id", event.id);
    onDeleted(event.id);
  };

  const startEdit = () => {
    setEditForm({
      type: event.type,
      title: event.title || "",
      date: event.date,
      time: event.time || "",
      location: event.location || "",
      opponent: event.opponent || "",
      notes: event.notes || "",
      home_color: event.home_color ?? null,
      away_color: event.away_color ?? null,
      our_score: event.our_score ?? null,
      their_score: event.their_score ?? null,
    });
    setApplyToSeries(false);
    setEditError("");
    setEditing(true);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    setEditError("");

    try {
      if (applyToSeries && event.recurrence_group_id) {
        const { date: newDate, ...seriesFields } = editForm;
        const deltaDays = Math.round(
          (new Date(newDate + "T00:00:00") - new Date(event.date + "T00:00:00")) / (1000 * 60 * 60 * 24)
        );

        const { data: seriesEvents, error: fetchError } = await supabase
          .from("calendar_events")
          .select("id, date")
          .eq("recurrence_group_id", event.recurrence_group_id);

        if (fetchError) {
          setEditError(fetchError.message);
          return;
        }
        if (!seriesEvents || seriesEvents.length === 0) {
          setEditError("Couldn't find the other events in this series — try refreshing the page and editing again.");
          return;
        }

        const results = await Promise.all(
          seriesEvents.map((ev) => {
            const shifted = new Date(ev.date + "T00:00:00");
            shifted.setDate(shifted.getDate() + deltaDays);
            return supabase
              .from("calendar_events")
              .update({ ...seriesFields, date: toDateString(shifted) })
              .eq("id", ev.id)
              .select();
          })
        );

        const failed = results.find((r) => r.error);
        if (failed) {
          setEditError(failed.error.message);
          return;
        }

        const noRowsUpdated = results.filter((r) => !r.data || r.data.length === 0).length;
        if (noRowsUpdated > 0) {
          setEditError(`${noRowsUpdated} of ${results.length} events in the series didn't update — this usually means a permissions issue. Try logging out and back in, then edit again.`);
          if (onReload) onReload();
          return;
        }

        setEditing(false);
        if (onReload) onReload();
        return;
      }

      const { data: updatedRows, error } = await supabase.from("calendar_events").update(editForm).eq("id", event.id).select();
      if (error) {
        setEditError(error.message);
        return;
      }
      if (!updatedRows || updatedRows.length === 0) {
        setEditError("That change didn't save — this usually means a permissions issue. Try logging out and back in, then edit again.");
        return;
      }
      onUpdated({ ...event, ...editForm });
      setEditing(false);
    } catch (err) {
      setEditError(err?.message || "Something went wrong saving these changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (editing) {
    return (
      <div className="glass-card p-4 space-y-3">
        {event.recurrence_group_id && (
          <div className="glass-card p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>This is part of a recurring series</div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="radio" checked={!applyToSeries} onChange={() => setApplyToSeries(false)} />
              This event only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={applyToSeries} onChange={() => setApplyToSeries(true)} />
              This and all other events in the series
            </label>
            {applyToSeries && (
              <p className="text-xs mt-2" style={{ color: "var(--gold-light)" }}>
                Changing the date will shift every event in the series by the same amount — e.g. moving this one from Monday to Tuesday moves the whole series to Tuesdays.
              </p>
            )}
          </div>
        )}
        <EventFields form={editForm} setForm={setEditForm} />
        {editError && <p className="text-sm" style={{ color: "#f28f8a" }}>{editError}</p>}
        <div className="flex gap-2">
          <button className="btn-accent px-4 py-2 rounded-lg text-sm" onClick={saveEdit} disabled={savingEdit || !editForm.date}>
            {savingEdit ? "Saving…" : "Save changes"}
          </button>
          <button className="btn-ghost px-4 py-2 rounded-lg text-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-left cursor-pointer" onClick={toggle}>
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
        {editable && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="opacity-50 hover:opacity-100" onClick={startEdit} title="Edit event">
              <Pencil className="w-4 h-4" />
            </button>
            <button className="opacity-50 hover:opacity-100" onClick={deleteEvent} title="Delete event">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {event.notes && <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>{event.notes}</p>}
          {!rsvps ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
          ) : players.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No players on the squad yet.</p>
          ) : (
            players.map((p) => {
              const r = rsvps[p.id] || { status: "pending", attended: false };
              const canEdit = editable || ownChildIds?.has(p.id);
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg flex-wrap" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-sm flex-1 min-w-[100px]">{p.name || "Unnamed"}</span>
                  <button
                    className="text-xs px-3 py-1.5 rounded-full font-medium disabled:cursor-default"
                    style={{
                      background: r.status === "attending" ? "#1FB65A" : "rgba(255,255,255,0.06)",
                      color: r.status === "attending" ? "#0b1223" : "var(--muted)",
                    }}
                    onClick={() => canEdit && setStatus(p.id, "attending")}
                    disabled={!canEdit}
                  >
                    Attend
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 rounded-full font-medium disabled:cursor-default"
                    style={{
                      background: r.status === "not_attending" ? "#E8433D" : "rgba(255,255,255,0.06)",
                      color: r.status === "not_attending" ? "white" : "var(--muted)",
                    }}
                    onClick={() => canEdit && setStatus(p.id, "not_attending")}
                    disabled={!canEdit}
                  >
                    Decline
                  </button>
                  {editable && (
                    <button
                      className="text-xs px-3 py-1.5 rounded-full font-medium"
                      style={{
                        background: r.attended ? "var(--accent)" : "rgba(255,255,255,0.06)",
                        color: r.attended ? "white" : "var(--muted)",
                      }}
                      onClick={() => toggleAttended(p.id, r.attended)}
                    >
                      Attended
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function TeamCalendar({ team, editable, ownChildIds }) {
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("upcoming"); // "upcoming" | "previous"

  const load = async () => {
    setLoading(true);
    const [{ data: ev }, { data: pl }] = await Promise.all([
      supabase.from("calendar_events").select("*").eq("team_id", team.id).order("date"),
      supabase.from("players").select("id, name, number").eq("team_id", team.id),
    ]);
    setEvents(ev || []);
    setPlayers(pl || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const todayStr = toDateString(new Date());
  const upcomingEvents = events.filter((e) => e.date >= todayStr);
  const previousEvents = events.filter((e) => e.date < todayStr).slice().sort((a, b) => b.date.localeCompare(a.date));
  const shownEvents = view === "previous" ? previousEvents : upcomingEvents;

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
              <EventCard
                key={ev.id}
                event={ev}
                players={players}
                editable={editable}
                ownChildIds={ownChildIds}
                onDeleted={(id) => setEvents((e) => e.filter((x) => x.id !== id))}
                onUpdated={(updated) => setEvents((e) => e.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.date.localeCompare(b.date)))}
                onReload={load}
              />
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
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-4 py-2 rounded-lg text-sm" onClick={() => setView("previous")}>Previous</button>
          {editable && !showForm && (
            <button className="btn-accent px-4 py-2 rounded-lg text-sm" onClick={() => setShowForm(true)}>+ Add event</button>
          )}
        </div>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {editable ? "Add fixtures and training, mark attendance after each one." : "Tap your own child's RSVP to update it — everyone else's is view only."}
      </p>

      {showForm && (
        <EventForm
          teamId={team.id}
          onCreated={(newEvents) => { setEvents((e) => [...e, ...newEvents].sort((a, b) => a.date.localeCompare(b.date))); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : upcomingEvents.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No upcoming events on the calendar yet.</div>
      ) : (
        <div className="space-y-3">
          {upcomingEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              players={players}
              editable={editable}
              ownChildIds={ownChildIds}
              onDeleted={(id) => setEvents((e) => e.filter((x) => x.id !== id))}
              onUpdated={(updated) => setEvents((e) => e.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.date.localeCompare(b.date)))}
              onReload={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchDaysTab({ team }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMatchdayId, setOpenMatchdayId] = useState(null);
  const [resolving, setResolving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: events } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("team_id", team.id)
      .eq("type", "match")
      .order("date", { ascending: false });
    const eventIds = (events || []).map((e) => e.id);
    const { data: mds } = eventIds.length
      ? await supabase.from("matchdays").select("id, event_id").in("event_id", eventIds)
      : { data: [] };
    const mdByEvent = Object.fromEntries((mds || []).map((m) => [m.event_id, m.id]));
    setMatches((events || []).map((e) => ({ ...e, matchdayId: mdByEvent[e.id] || null })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const openMatch = async (match) => {
    if (match.matchdayId) {
      setOpenMatchdayId(match.matchdayId);
      return;
    }
    // Legacy match created before matchdays existed -- create one now.
    setResolving(true);
    const { data, error } = await supabase
      .from("matchdays")
      .insert({ event_id: match.id, team_id: team.id, format: "7v7", breakdown: "quarters", segments: buildSegments("quarters") })
      .select()
      .single();
    setResolving(false);
    if (!error && data) setOpenMatchdayId(data.id);
  };

  if (openMatchdayId) {
    return (
      <div>
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <button className="text-sm flex items-center gap-1" style={{ color: "var(--muted)" }} onClick={() => { setOpenMatchdayId(null); load(); }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to match days
          </button>
        </div>
        <MatchDayView matchdayId={openMatchdayId} teamId={team.id} editable={true} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-1">Match Days</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Every match on the calendar gets its own Match Day — squad selections, goals, and comments per quarter or half.
      </p>
      {loading || resolving ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : matches.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>
          No matches on the calendar yet — add one from the Calendar tab.
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <button key={m.id} className="glass-card w-full flex items-center gap-3 p-3 text-left" onClick={() => openMatch(m)}>
              <div className="flex-1">
                <div className="font-medium">
                  {m.title || `vs ${m.opponent || "TBC"}`}
                  {m.our_score !== null && m.our_score !== undefined && m.their_score !== null && m.their_score !== undefined && (
                    <span className="ml-2 font-mono text-sm" style={{ color: "var(--gold-light)" }}>{m.our_score} - {m.their_score}</span>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {m.date}{m.time ? ` · ${m.time}` : ""}{m.location ? ` · ${m.location}` : ""}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--muted)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainingPlansTab({ team }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPlayer, setOpenPlayer] = useState(null);

  useEffect(() => {
    supabase.from("players").select("*").eq("team_id", team.id).then(({ data }) => {
      setPlayers(data || []);
      setLoading(false);
    });
  }, [team.id]);

  if (openPlayer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button className="text-sm flex items-center gap-1 mb-6" style={{ color: "var(--muted)" }} onClick={() => setOpenPlayer(null)}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to training plans
        </button>
        <h1 className="font-display text-2xl tracking-wide mb-6">{openPlayer.name || "Unnamed player"}</h1>
        <TrainingPlanEditor playerId={openPlayer.id} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-6">Training Plans</h1>
      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : players.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No players yet.</div>
      ) : (
        <div className="space-y-2">
          {sortByNumber(players).map((p) => (
            <button key={p.id} className="glass-card w-full flex items-center gap-3 p-3 text-left" onClick={() => setOpenPlayer(p)}>
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2" style={{ borderColor: "var(--accent)" }}>
                {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> :
                  <Users className="w-4 h-4" style={{ color: "var(--muted)" }} />}
              </div>
              <span className="flex-1 font-medium">{p.name || "Unnamed player"}</span>
              <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>#{p.number || "—"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CoachTeamPage({ profile, onSignOut }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState("team");
  const [openPlayer, setOpenPlayer] = useState(null);
  const [reloadRoster, setReloadRoster] = useState(null);

  useEffect(() => {
    supabase
      .from("coach_team_links")
      .select("teams(id, name, logo_url)")
      .eq("coach_id", profile.id)
      .then(({ data }) => {
        const list = (data || []).map((r) => r.teams).filter(Boolean);
        setTeams(list);
        if (list.length) setActiveTeamId(list[0].id);
        setLoading(false);
      });
  }, [profile]);

  const activeTeam = teams.find((t) => t.id === activeTeamId);

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

  const handleOpenPlayer = (player, reload) => {
    setOpenPlayer(player);
    setReloadRoster(() => reload);
  };

  const closePlayer = () => {
    setOpenPlayer(null);
    if (reloadRoster) reloadRoster();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-6 max-w-sm text-center">
          <p className="mb-4" style={{ color: "var(--muted)" }}>You're not linked to any team yet — ask your club for an invite link.</p>
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
          {teams.length > 1 ? (
            <select
              className="text-sm py-1.5 px-2 rounded-lg"
              style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
              value={activeTeamId}
              onChange={(e) => setActiveTeamId(e.target.value)}
            >
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <span className="font-display text-lg tracking-wide">{activeTeam?.name}</span>
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
        <PlayerDetail
          player={openPlayer}
          onBack={closePlayer}
          onSaved={() => closePlayer()}
          onDeleted={() => closePlayer()}
        />
      ) : activeTab === "calendar" ? (
        activeTeam && <TeamCalendar team={activeTeam} editable={true} />
      ) : activeTab === "clubCalendar" ? (
        <ClubCalendarTab teams={clubTeams} />
      ) : activeTab === "matchday" ? (
        activeTeam && <MatchDaysTab team={activeTeam} />
      ) : activeTab === "plans" ? (
        activeTeam && <TrainingPlansTab team={activeTeam} />
      ) : activeTab === "session" ? (
        activeTeam && <TrainingSessionView team={activeTeam} editable={true} />
      ) : activeTab === "documents" ? (
        activeTeam && <DocumentsView team={activeTeam} editable={true} />
      ) : (
        activeTeam && <TeamRoster team={activeTeam} onOpenPlayer={handleOpenPlayer} />
      )}
    </div>
  );
}
