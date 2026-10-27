import { useEffect, useRef, useState } from "react";
import { Circle, ArrowUpRight, Eraser, CircleDot, Plus, Trash2, ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { uid } from "../lib/utils.js";

export { uid };

export const TOOLS = [
  { id: "blue", label: "Blue marker", kind: "dot", color: "#2E7CF6" },
  { id: "red", label: "Red marker", kind: "dot", color: "#E8433D" },
  { id: "player", label: "Player (P1, P2…)", kind: "player", color: "#FFD21F" },
  { id: "run", label: "Run (solid)", kind: "arrow", style: "solid" },
  { id: "pass", label: "Pass (dashed)", kind: "arrow", style: "dashed" },
  { id: "dribble", label: "Dribble (curve up)", kind: "arrow", style: "curved" },
  { id: "dribbleDown", label: "Dribble (curve down)", kind: "arrow", style: "curved-down" },
  { id: "shoot", label: "Shoot (ball + arrow)", kind: "arrow", style: "shoot" },
  { id: "dragarrow", label: "Drag arrow", kind: "drag-arrow" },
  { id: "erase", label: "Erase", kind: "erase" },
];

export function defaultPitch(title = "") {
  return { markers: [], arrows: [], notes: "", ...(title ? { title } : {}) };
}

// Toolbar shared by the training session blocks and the individual drill pitches
export function ToolPalette({ toolId, setToolId, compact = false }) {
  const iconCls = compact ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mb-3" : "mb-6"}`}>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`btn-ghost ${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} rounded-lg flex items-center gap-1.5 ${toolId === t.id ? "ring-2 ring-white" : ""}`}
          onClick={() => setToolId(t.id)}
        >
          {t.kind === "dot" && <Circle className={iconCls} fill={t.color} stroke={t.color} />}
          {t.kind === "player" && <Circle className={iconCls} fill={t.color} stroke="white" />}
          {t.kind === "arrow" && t.style === "shoot" && <CircleDot className={iconCls} />}
          {t.kind === "arrow" && t.style !== "shoot" && <ArrowUpRight className={iconCls} />}
          {t.kind === "drag-arrow" && <ArrowUpRight className={iconCls} strokeWidth={3} />}
          {t.kind === "erase" && <Eraser className={iconCls} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function nextPlayerNumber(markers) {
  const used = new Set(markers.filter((m) => m.kind === "player").map((m) => m.n));
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

export function Quadrant({ index, quadrant, setQuadrant, tool, editable, label, showNotes = true, onRename }) {
  const svgRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [dragMarkerId, setDragMarkerId] = useState(null);
  const [dragArrowStart, setDragArrowStart] = useState(null);
  const [dragArrowPreview, setDragArrowPreview] = useState(null);

  const getPoint = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(1, Math.min(99, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(1, Math.min(65, ((e.clientY - rect.top) / rect.height) * 66));
    return { x, y };
  };

  const handleClick = (e) => {
    if (!editable || !tool) return;
    const pt = getPoint(e);
    if (tool.kind === "dot") {
      setQuadrant({ ...quadrant, markers: [...quadrant.markers, { id: uid(), x: pt.x, y: pt.y, color: tool.color }] });
      return;
    }
    if (tool.kind === "player") {
      const n = nextPlayerNumber(quadrant.markers);
      setQuadrant({ ...quadrant, markers: [...quadrant.markers, { id: uid(), x: pt.x, y: pt.y, color: tool.color, kind: "player", n }] });
      return;
    }
    if (tool.kind === "arrow") {
      if (!pending) setPending(pt);
      else {
        setQuadrant({ ...quadrant, arrows: [...quadrant.arrows, { id: uid(), x1: pending.x, y1: pending.y, x2: pt.x, y2: pt.y, style: tool.style }] });
        setPending(null);
      }
    }
  };

  const handlePointerDown = (e) => {
    if (!editable) return;
    if (tool?.kind === "drag-arrow") {
      const pt = getPoint(e);
      setDragArrowStart(pt);
      setDragArrowPreview(pt);
    }
  };

  const handlePointerMove = (e) => {
    if (dragMarkerId) {
      const pt = getPoint(e);
      setQuadrant({ ...quadrant, markers: quadrant.markers.map((m) => (m.id === dragMarkerId ? { ...m, x: pt.x, y: pt.y } : m)) });
      return;
    }
    if (dragArrowStart) setDragArrowPreview(getPoint(e));
  };

  const handlePointerUp = (e) => {
    if (dragMarkerId) {
      setDragMarkerId(null);
      return;
    }
    if (dragArrowStart) {
      const pt = getPoint(e);
      const dist = Math.hypot(pt.x - dragArrowStart.x, pt.y - dragArrowStart.y);
      if (dist > 2) {
        setQuadrant({ ...quadrant, arrows: [...quadrant.arrows, { id: uid(), x1: dragArrowStart.x, y1: dragArrowStart.y, x2: pt.x, y2: pt.y, style: "solid" }] });
      }
      setDragArrowStart(null);
      setDragArrowPreview(null);
    }
  };

  const startMarkerDrag = (e, id) => {
    if (!editable || tool?.kind === "erase") return;
    e.stopPropagation();
    setDragMarkerId(id);
  };

  const eraseMarker = (id, e) => {
    e.stopPropagation();
    if (!editable || tool?.kind !== "erase") return;
    setQuadrant({ ...quadrant, markers: quadrant.markers.filter((m) => m.id !== id) });
  };
  const eraseArrow = (id, e) => {
    e.stopPropagation();
    if (!editable || tool?.kind !== "erase") return;
    setQuadrant({ ...quadrant, arrows: quadrant.arrows.filter((a) => a.id !== id) });
  };

  const clearAll = () => setQuadrant({ ...quadrant, markers: [], arrows: [] });

  const aid = `arrowhead-${index}`;

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        {onRename && editable ? (
          <input
            className="input-dark flex-1 min-w-0 text-sm py-1"
            value={label}
            placeholder="Pitch title"
            onChange={(e) => onRename(e.target.value)}
          />
        ) : (
          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
        )}
        {editable && <button className="text-xs opacity-60 hover:opacity-100 flex-shrink-0" onClick={clearAll}>Clear</button>}
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 100 66"
        className="w-full"
        style={{
          aspectRatio: "3/2",
          touchAction: "none",
          background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 40px, rgba(0,0,0,0.02) 40px 80px), linear-gradient(180deg, #168a3f, #136b34)",
          border: "2px solid rgba(255,255,255,0.35)",
          borderRadius: 6,
          cursor: editable ? "crosshair" : "default",
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect x="1" y="1" width="98" height="64" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <line x1="50" y1="1" x2="50" y2="65" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <circle cx="50" cy="33" r="9" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <rect x="1" y="18" width="14" height="30" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        <rect x="85" y="18" width="14" height="30" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />

        <defs>
          <marker id={aid} markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="white" />
          </marker>
          <marker id={`${aid}-shoot`} markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#FFD21F" />
          </marker>
        </defs>

        {quadrant.arrows.map((a) => {
          const dashArr = a.style === "dashed" ? "2,1.5" : undefined;
          if (a.style === "curved" || a.style === "curved-down") {
            const mx = (a.x1 + a.x2) / 2;
            const my = (a.y1 + a.y2) / 2 + (a.style === "curved" ? -8 : 8);
            return (
              <path key={a.id} d={`M ${a.x1} ${a.y1} Q ${mx} ${my} ${a.x2} ${a.y2}`} fill="none" stroke="white" strokeWidth="0.8"
                markerEnd={`url(#${aid})`} onClick={(e) => eraseArrow(a.id, e)} />
            );
          }
          if (a.style === "shoot") {
            // Ball at the start, bold arrow pointing wherever the second click was set.
            const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1;
            const ux = (a.x2 - a.x1) / len;
            const uy = (a.y2 - a.y1) / len;
            const sx = a.x1 + ux * 2.4;
            const sy = a.y1 + uy * 2.4;
            return (
              <g key={a.id} onClick={(e) => eraseArrow(a.id, e)}>
                <line x1={sx} y1={sy} x2={a.x2} y2={a.y2} stroke="#FFD21F" strokeWidth="1.2" markerEnd={`url(#${aid}-shoot)`} />
                <circle cx={a.x1} cy={a.y1} r="2.1" fill="white" stroke="#111" strokeWidth="0.35" />
                <circle cx={a.x1} cy={a.y1} r="0.85" fill="#111" />
                <circle cx={a.x1 + 1.2} cy={a.y1 - 0.9} r="0.35" fill="#111" />
                <circle cx={a.x1 - 1.2} cy={a.y1 - 0.9} r="0.35" fill="#111" />
                <circle cx={a.x1 + 0.9} cy={a.y1 + 1.2} r="0.35" fill="#111" />
                <circle cx={a.x1 - 0.9} cy={a.y1 + 1.2} r="0.35" fill="#111" />
              </g>
            );
          }
          return (
            <line key={a.id} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="white" strokeWidth="0.8" strokeDasharray={dashArr}
              markerEnd={`url(#${aid})`} onClick={(e) => eraseArrow(a.id, e)} />
          );
        })}

        {dragArrowStart && dragArrowPreview && (
          <line x1={dragArrowStart.x} y1={dragArrowStart.y} x2={dragArrowPreview.x} y2={dragArrowPreview.y}
            stroke="yellow" strokeWidth="0.8" strokeDasharray="1.5,1" markerEnd={`url(#${aid})`} />
        )}

        {quadrant.markers.map((m) => (
          <g key={m.id} style={{ cursor: editable && tool?.kind !== "erase" ? "grab" : "default" }}
            onPointerDown={(e) => startMarkerDrag(e, m.id)} onClick={(e) => eraseMarker(m.id, e)}>
            <circle cx={m.x} cy={m.y} r="2.3" fill={m.color} stroke="white" strokeWidth="0.4" />
            {m.kind === "player" && (
              <text x={m.x + 3.2} y={m.y + 1} fontSize="2.8" fontWeight="700" fill="white" stroke="rgba(0,0,0,0.55)" strokeWidth="0.35" paintOrder="stroke" style={{ pointerEvents: "none" }}>
                {`P${m.n}`}
              </text>
            )}
          </g>
        ))}

        {pending && <circle cx={pending.x} cy={pending.y} r="1.3" fill="yellow" />}
      </svg>

      {showNotes && (
        <div className="mt-3">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Notes</label>
          <textarea
            className="input-dark w-full mt-1 min-h-[60px]"
            placeholder={editable ? "Add notes for this session…" : "No notes added yet."}
            value={quadrant.notes || ""}
            disabled={!editable}
            onChange={(e) => setQuadrant({ ...quadrant, notes: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function newBlock(n, pitches) {
  return {
    id: uid(),
    title: `Training block ${n}`,
    info: "",
    pitches: pitches || Array.from({ length: 4 }, (_, i) => ({ id: uid(), title: `Pitch ${i + 1}`, markers: [], arrows: [], notes: "" })),
  };
}

function hasContent(q) {
  return q && ((q.markers && q.markers.length) || (q.arrows && q.arrows.length) || (q.notes && q.notes.trim()));
}

export default function TrainingSessionView({ team, editable }) {
  const [blocks, setBlocks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openBlockId, setOpenBlockId] = useState(null);
  const [toolId, setToolId] = useState(editable ? "blue" : null);
  const saveTimer = useRef(null);

  useEffect(() => {
    setOpenBlockId(null);
    supabase.from("teams").select("session, training_blocks").eq("id", team.id).single().then(({ data }) => {
      let list = Array.isArray(data?.training_blocks) ? data.training_blocks : [];
      if (list.length === 0) {
        // First time: start with 4 blocks. Anything drawn on the old single
        // session page is carried into Block 1 so nothing is lost.
        list = [1, 2, 3, 4].map((n) => newBlock(n));
        const old = data?.session?.quadrants;
        if (Array.isArray(old) && old.some(hasContent)) {
          list[0] = {
            ...list[0],
            pitches: old.slice(0, 4).map((q, i) => ({ id: uid(), title: `Pitch ${i + 1}`, markers: q.markers || [], arrows: q.arrows || [], notes: q.notes || "" })),
          };
        }
      }
      setBlocks(list);
      setLoading(false);
    });
  }, [team.id]);

  const persist = (next) => {
    setBlocks(next);
    if (!editable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("teams").update({ training_blocks: next }).eq("id", team.id);
      setSaving(false);
    }, 400);
  };

  const updateBlock = (id, patch) => persist(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const updatePitch = (blockId, pitchId, patch) => {
    persist(blocks.map((b) => (b.id !== blockId ? b : { ...b, pitches: b.pitches.map((p) => (p.id === pitchId ? { ...p, ...patch } : p)) })));
  };

  const addBlock = () => persist([...blocks, newBlock(blocks.length + 1)]);

  const removeBlock = (id) => {
    if (!confirm("Delete this training block and everything drawn in it?")) return;
    persist(blocks.filter((b) => b.id !== id));
    setOpenBlockId(null);
  };

  const tool = TOOLS.find((t) => t.id === toolId) || null;

  if (loading || !blocks) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  const openBlock = blocks.find((b) => b.id === openBlockId);

  // ---------- Inside one block: the original session page + new widgets ----------
  if (openBlock) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <button className="text-sm flex items-center gap-1" style={{ color: "var(--muted)" }} onClick={() => setOpenBlockId(null)}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to training blocks
          </button>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs" style={{ color: "var(--muted)" }}>Saving…</span>}
            {editable && (
              <button className="opacity-60 hover:opacity-100" title="Delete this block" onClick={() => removeBlock(openBlock.id)}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {editable ? (
          <input
            className="input-dark w-full font-display text-2xl mb-4"
            value={openBlock.title}
            placeholder="Block title"
            onChange={(e) => updateBlock(openBlock.id, { title: e.target.value })}
          />
        ) : (
          <h1 className="font-display text-2xl tracking-wide mb-4">{openBlock.title}</h1>
        )}

        <div className="glass-panel p-3 mb-4">
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Additional information</label>
          {editable ? (
            <textarea
              className="input-dark w-full mt-1 min-h-[56px]"
              placeholder="Session aims, equipment, timings, coaching points…"
              value={openBlock.info || ""}
              onChange={(e) => updateBlock(openBlock.id, { info: e.target.value })}
            />
          ) : (
            <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: openBlock.info ? "var(--white)" : "var(--muted)" }}>
              {openBlock.info || "No additional information added."}
            </p>
          )}
        </div>

        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          {editable
            ? "Pick a tool, then click a pitch to place it — markers can be dragged afterwards. Arrows (and the shoot ball) take two clicks: start, then where it points. Drag arrow: press, drag, release."
            : "View only — ask your coach to make edits."}
        </p>

        {editable && <ToolPalette toolId={toolId} setToolId={setToolId} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openBlock.pitches.map((p) => (
            <Quadrant
              key={p.id}
              index={p.id}
              quadrant={p}
              setQuadrant={(val) => updatePitch(openBlock.id, p.id, { markers: val.markers, arrows: val.arrows, notes: val.notes })}
              tool={tool}
              editable={editable}
              label={p.title || ""}
              onRename={(title) => updatePitch(openBlock.id, p.id, { title })}
            />
          ))}
        </div>
      </div>
    );
  }

  // ---------- Opening page: just boxes with amendable titles ----------
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl tracking-wide">Training Session</h1>
        {saving && <span className="text-xs" style={{ color: "var(--muted)" }}>Saving…</span>}
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {editable ? "Rename a block by typing in its box, then open it to plan the session." : "Training blocks planned by your coach."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {blocks.map((b) => (
          <div key={b.id} className="glass-panel p-4 flex flex-col gap-3">
            {editable ? (
              <input
                className="input-dark w-full font-display text-lg"
                value={b.title}
                placeholder="Block title"
                onChange={(e) => updateBlock(b.id, { title: e.target.value })}
              />
            ) : (
              <div className="font-display text-lg">{b.title}</div>
            )}
            <button className="btn-accent px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1" onClick={() => setOpenBlockId(b.id)}>
              Open block <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ))}
        {editable && (
          <button
            className="glass-panel p-4 flex items-center justify-center gap-2 min-h-[110px]"
            style={{ borderStyle: "dashed", color: "var(--muted)" }}
            onClick={addBlock}
          >
            <Plus className="w-5 h-5" /> Add block
          </button>
        )}
      </div>
    </div>
  );
}
