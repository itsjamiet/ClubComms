import { useEffect, useState } from "react";
import { Trash2, Megaphone } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";

const AUDIENCE_LABELS = { everyone: "Everyone", coaches: "Coaches only", parents: "Parents only" };

function timeAgo(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// Club: write + manage announcements. Coaches / parents: read them (new ones
// are flagged, and the red badge on the tab clears once they've been seen).
export default function Announcements({ role, userId, clubId, onSeen }) {
  const isClub = role === "club";
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [lastSeen, setLastSeen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", body: "", audience: "everyone", team_id: "" });
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [{ data: seen }, { data: anns }] = await Promise.all([
      supabase.from("announcement_seen").select("last_seen").eq("user_id", userId).maybeSingle(),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    ]);
    setLastSeen(seen?.last_seen ? new Date(seen.last_seen).getTime() : 0);
    setItems(anns || []);
    setLoading(false);
    if (!isClub && onSeen) onSeen();
  };

  useEffect(() => {
    load();
    if (isClub && clubId) {
      supabase.from("teams").select("id, name").eq("club_id", clubId).then(({ data }) => setTeams(data || []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, userId]);

  const post = async () => {
    if (!form.title.trim()) return;
    setPosting(true);
    setError("");
    const { error } = await supabase.from("announcements").insert({
      club_id: clubId,
      team_id: form.team_id || null,
      title: form.title.trim(),
      body: form.body.trim() || null,
      audience: form.audience,
      created_by: userId,
    });
    setPosting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ title: "", body: "", audience: "everyone", team_id: "" });
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    load();
  };

  const teamName = (id) => teams.find((t) => t.id === id)?.name;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-1">Announcements</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {isClub
          ? "Post news to your coaches and parents. They get a red alert on their Announcements tab until they've read it."
          : "News from your club."}
      </p>

      {isClub && (
        <div className="glass-panel p-5 mb-8 space-y-3">
          <input
            className="input-dark w-full"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="input-dark w-full min-h-[90px]"
            placeholder="Message"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Send to</label>
              <select
                className="w-full mt-1 rounded-lg px-2.5 py-2"
                style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="everyone">Everyone (coaches + parents)</option>
                <option value="coaches">Coaches only</option>
                <option value="parents">Parents only</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Which teams</label>
              <select
                className="w-full mt-1 rounded-lg px-2.5 py-2"
                style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
                value={form.team_id}
                onChange={(e) => setForm({ ...form, team_id: e.target.value })}
              >
                <option value="">Whole club</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
          <button className="btn-accent px-5 py-2 rounded-lg flex items-center gap-2" onClick={post} disabled={posting || !form.title.trim()}>
            <Megaphone className="w-4 h-4" /> {posting ? "Posting…" : "Post announcement"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No announcements yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const isNew = !isClub && new Date(a.created_at).getTime() > lastSeen;
            return (
              <div key={a.id} className="glass-card p-4" style={isNew ? { borderColor: "#E8433D" } : undefined}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.title}</span>
                      {isNew && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#E8433D", color: "white" }}>NEW</span>}
                    </div>
                    {a.body && <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "var(--white)" }}>{a.body}</p>}
                    <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                      {timeAgo(a.created_at)}
                      {isClub && ` · ${AUDIENCE_LABELS[a.audience]}${a.team_id ? ` · ${teamName(a.team_id) || "One team"}` : " · Whole club"}`}
                    </div>
                  </div>
                  {isClub && (
                    <button className="opacity-50 hover:opacity-100 flex-shrink-0" onClick={() => remove(a.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
