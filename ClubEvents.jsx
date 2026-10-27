import { useEffect, useState } from "react";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { toDateString } from "../lib/utils.js";

const AUDIENCE_LABEL = { everyone: "Everyone", coaches: "Coaches only" };

function EventHeader({ ev }) {
  const when = new Date(`${ev.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <div>
      <div className="font-medium">{ev.title}</div>
      <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
        {when}{ev.time ? ` · ${ev.time}` : ""}{ev.location ? ` · ${ev.location}` : ""}
      </div>
      {ev.description && <p className="text-sm mt-2 whitespace-pre-wrap">{ev.description}</p>}
    </div>
  );
}

// ---------------- Club view: create events, see who volunteered ----------------
function ClubSide({ clubId, userId }) {
  const [events, setEvents] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", description: "", audience: "everyone" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [{ data: evs }, { data: rs }] = await Promise.all([
      supabase.from("club_events").select("*").eq("club_id", clubId).order("date", { ascending: true }),
      supabase.from("club_event_responses").select("*"),
    ]);
    setEvents(evs || []);
    setResponses(rs || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const create = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("club_events").insert({
      club_id: clubId,
      title: form.title.trim(),
      date: form.date,
      time: form.time || null,
      location: form.location || null,
      description: form.description || null,
      audience: form.audience,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ title: "", date: "", time: "", location: "", description: "", audience: "everyone" });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this event and all its responses?")) return;
    await supabase.from("club_events").delete().eq("id", id);
    load();
  };

  const today = toDateString(new Date());
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today).reverse();

  const tally = (eventId) => {
    const rs = responses.filter((r) => r.event_id === eventId);
    const yes = rs.filter((r) => r.status === "attending");
    const no = rs.filter((r) => r.status === "not_attending");
    return {
      coachYes: yes.filter((r) => r.role === "coach"),
      parentYes: yes.filter((r) => r.role === "parent"),
      clubYes: yes.filter((r) => r.role === "club"),
      coachNo: no.filter((r) => r.role === "coach").length,
      parentNo: no.filter((r) => r.role === "parent").length,
    };
  };

  const totals = upcoming.reduce(
    (acc, e) => {
      const t = tally(e.id);
      acc.coaches += t.coachYes.length;
      acc.parents += t.parentYes.length;
      return acc;
    },
    { coaches: 0, parents: 0 }
  );

  const renderEvent = (ev) => {
    const t = tally(ev.id);
    const open = expanded === ev.id;
    return (
      <div key={ev.id} className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <EventHeader ev={ev} />
            <div className="text-[11px] mt-2 inline-block px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              Sent to: {AUDIENCE_LABEL[ev.audience]}
            </div>
          </div>
          <button className="opacity-50 hover:opacity-100 flex-shrink-0" onClick={() => remove(ev.id)} title="Delete event">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="font-mono text-xl">{t.coachYes.length}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>Coach volunteers</div>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="font-mono text-xl">{ev.audience === "everyone" ? t.parentYes.length : "—"}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>Parent volunteers</div>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "rgba(31,182,90,0.15)" }}>
            <div className="font-mono text-xl">{t.coachYes.length + t.parentYes.length}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>Total volunteers</div>
          </div>
        </div>

        <button className="text-xs mt-3 flex items-center gap-1" style={{ color: "var(--accent)" }} onClick={() => setExpanded(open ? null : ev.id)}>
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Who's volunteering
        </button>
        {open && (
          <div className="mt-2 text-sm space-y-2">
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Coaches ({t.coachYes.length}) · declined {t.coachNo}</div>
              {t.coachYes.length === 0 ? <div style={{ color: "var(--muted)" }}>None yet</div> : t.coachYes.map((r) => <div key={r.user_id}>{r.display_name || "Coach"}</div>)}
            </div>
            {ev.audience === "everyone" && (
              <div>
                <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Parents ({t.parentYes.length}) · declined {t.parentNo}</div>
                {t.parentYes.length === 0 ? <div style={{ color: "var(--muted)" }}>None yet</div> : t.parentYes.map((r) => <div key={r.user_id}>{r.display_name || "Parent"}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-xl tracking-wide">Club events</h2>
        <button className="btn-accent px-3 py-1.5 rounded-lg text-sm flex items-center gap-1" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" /> {showForm ? "Close" : "Add event"}
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Events sent to your coaches and parents. They choose Attend or Not attend, and you see the volunteers here.
      </p>

      {showForm && (
        <div className="glass-panel p-5 mb-5 space-y-3">
          <input className="input-dark w-full" placeholder="Event title (e.g. Summer fun day)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className="input-dark w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input type="time" className="input-dark w-full" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <input className="input-dark w-full" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <textarea className="input-dark w-full min-h-[70px]" placeholder="Details (what's needed, who to ask…)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Send invite to</label>
            <select
              className="w-full mt-1 rounded-lg px-2.5 py-2"
              style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="everyone">Everyone — coaches and parents</option>
              <option value="coaches">Coaches only</option>
            </select>
          </div>
          {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
          <button className="btn-accent px-5 py-2 rounded-lg" onClick={create} disabled={saving || !form.title.trim() || !form.date}>
            {saving ? "Sending…" : "Create & send invite"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="glass-panel p-3 mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span style={{ color: "var(--muted)" }}>Upcoming events — volunteers so far:</span>
              <span><b className="font-mono">{totals.coaches}</b> coaches</span>
              <span><b className="font-mono">{totals.parents}</b> parents</span>
              <span><b className="font-mono">{totals.coaches + totals.parents}</b> total</span>
            </div>
          )}
          {upcoming.length === 0 ? (
            <div className="glass-panel p-8 text-center" style={{ color: "var(--muted)" }}>No upcoming club events. Use “Add event” to create one.</div>
          ) : (
            <div className="space-y-3">{upcoming.map(renderEvent)}</div>
          )}
          {past.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm cursor-pointer" style={{ color: "var(--muted)" }}>Past events ({past.length})</summary>
              <div className="space-y-3 mt-3">{past.map(renderEvent)}</div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ---------------- Coach / parent view: see events, attend or not ----------------
function MemberSide({ clubId, userId, onResponded }) {
  const [events, setEvents] = useState([]);
  const [mine, setMine] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    const [{ data: evs }, { data: rs }] = await Promise.all([
      supabase.from("club_events").select("*").order("date", { ascending: true }),
      supabase.from("club_event_responses").select("event_id, status").eq("user_id", userId),
    ]);
    setEvents(evs || []);
    setMine(Object.fromEntries((rs || []).map((r) => [r.event_id, r.status])));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, userId]);

  const respond = async (eventId, status) => {
    setError("");
    const prev = mine[eventId];
    setMine((m) => ({ ...m, [eventId]: status }));
    const { error } = await supabase.rpc("respond_to_club_event", { p_event_id: eventId, p_status: status });
    if (error) {
      setMine((m) => ({ ...m, [eventId]: prev }));
      setError(error.message);
      return;
    }
    if (onResponded) onResponded();
  };

  const today = toDateString(new Date());
  const upcoming = events.filter((e) => e.date >= today);

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  if (upcoming.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-display text-xl tracking-wide mb-1">Club events</h2>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Your club would like to know if you can make these.</p>
      {error && <p className="text-sm mb-2" style={{ color: "#f28f8a" }}>{error}</p>}
      <div className="space-y-3">
        {upcoming.map((ev) => {
          const status = mine[ev.id];
          return (
            <div key={ev.id} className="glass-card p-4" style={!status ? { borderColor: "#E8433D" } : undefined}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0"><EventHeader ev={ev} /></div>
                {!status && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: "#E8433D", color: "white" }}>NEW</span>}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  className={`${status === "attending" ? "btn-accent" : "btn-ghost"} px-4 py-1.5 rounded-lg text-sm`}
                  onClick={() => respond(ev.id, "attending")}
                >
                  Attend
                </button>
                <button
                  className={`${status === "not_attending" ? "btn-accent" : "btn-ghost"} px-4 py-1.5 rounded-lg text-sm`}
                  onClick={() => respond(ev.id, "not_attending")}
                >
                  Not attend
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClubEvents({ role, clubId, userId, onResponded }) {
  if (!clubId || !userId) return null;
  return role === "club" ? <ClubSide clubId={clubId} userId={userId} /> : <MemberSide clubId={clubId} userId={userId} onResponded={onResponded} />;
}
