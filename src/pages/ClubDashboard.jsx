import { useEffect, useState } from "react";
import { Plus, Users, Trash2, ArrowLeft, Upload, FileText, Camera, Eye, Download } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { toDateString, fileToDataUrl, resizeImage, displayAge, statTotals, awardsForStat, AGE_GROUPS, viewStoredFile, downloadStoredFile } from "../lib/utils.js";
import ClubCalendarTab from "./ClubCalendar.jsx";
import Announcements from "./Announcements.jsx";
import { buildGazetteHtml, GAZETTE_STYLES, GAZETTE_WIDTH } from "../lib/gazette.js";
import { ChangePasswordCard, DeleteAccountCard, LegalLinks } from "../components/AccountSettings.jsx";
import AppHeader from "../components/AppHeader.jsx";
import DropdownMenu, { DropdownItem } from "../components/DropdownMenu.jsx";

// Team tile: just the name, age group and whether the team is open or full.
function TeamCard({ team, onOpen }) {
  return (
    <button className="glass-card flex flex-col items-center text-center p-5 justify-center min-h-[110px]" onClick={() => onOpen(team)}>
      <div className="font-display text-lg truncate w-full">{team.name}</div>
      <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>{team.age_group || "No age group"}</div>
      <div
        className="text-xs mt-2 px-2.5 py-0.5 rounded-full font-semibold"
        style={team.is_full ? { background: "rgba(232,67,61,0.2)", color: "#ff9a95" } : { background: "rgba(31,182,90,0.2)", color: "#6fe39a" }}
      >
        {team.is_full ? "Team full" : "Team open"}
      </div>
    </button>
  );
}

function InviteClubAdmin({ clubId }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    const { data, error } = await supabase
      .from("invites")
      .insert({ club_id: clubId, role: "club", created_by: (await supabase.auth.getUser()).data.user.id })
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
    <div className="glass-panel p-6 mb-6">
      <h2 className="font-display text-lg mb-1">Club admins</h2>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Generate a link to give someone else full club access — teams, calendar,
        documents, everything you can see.
      </p>
      {!link ? (
        <button className="btn-accent px-4 py-2 rounded-lg text-sm" onClick={generateInvite} disabled={loading}>
          {loading ? "Generating…" : "Generate admin invite link"}
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

function InviteCoach({ teamId }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    const { data, error } = await supabase
      .from("invites")
      .insert({ team_id: teamId, role: "coach", created_by: (await supabase.auth.getUser()).data.user.id })
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
    <div className="glass-panel p-6 mb-6">
      <h2 className="font-display text-lg mb-1">Coaches</h2>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Generate a link and send it to a coach — opening it lets them create their
        account and joins them to this team automatically.
      </p>
      {!link ? (
        <button className="btn-accent px-4 py-2 rounded-lg text-sm" onClick={generateInvite} disabled={loading}>
          {loading ? "Generating…" : "Generate invite link"}
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

function sortByNumber(players) {
  return [...players].sort((a, b) => {
    const na = a.number === "" || a.number === null || a.number === undefined ? Infinity : Number(a.number);
    const nb = b.number === "" || b.number === null || b.number === undefined ? Infinity : Number(b.number);
    return na - nb;
  });
}

function ClubPlayerCard({ player, onOpen }) {
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
        <span>Age {displayAge(player)}</span>
      </div>
    </button>
  );
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

function ClubPlayerView({ player, onBack }) {
  const stats = player.stats || [];
  const t = statTotals(stats);
  const attendance = useAttendanceStats(player.team_id, player.id);

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

      <div className="grid grid-cols-3 gap-4 mb-6">
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
          <div className="text-lg mt-1">{displayAge(player)}</div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h2 className="font-display text-lg mb-3">Overall stats</h2>
        {stats.length === 0 && !attendance ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>No stats logged yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ...(attendance ? [
                { label: "Training sessions attended", value: `${attendance.trainingAttended}/${attendance.trainingTotal}` },
                { label: "Matches attended", value: `${attendance.matchAttended}/${attendance.matchTotal}` },
              ] : []),
              { label: "Minutes played", value: t.minutesPct === null ? "—" : `${t.minutesPct}%` },
              { label: "Goals", value: t.goalsTotal },
              { label: "Saves", value: t.savesTotal },
              { label: "Tackles", value: t.tacklesTotal },
              { label: "Captain", value: t.captainTotal },
              { label: "Player of the match", value: t.potmTotal },
              { label: "Parents' player of the match", value: t.parentsPotmTotal },
            ].map((b) => (
              <div key={b.label} className="glass-card p-4">
                <div className="text-2xl font-mono">{b.value}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{b.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamDetail({ team, onBack, onDeleted, onRenamed }) {
  const [name, setName] = useState(team.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [openPlayer, setOpenPlayer] = useState(null);
  const [showInviteCoach, setShowInviteCoach] = useState(false);
  const [ageGroup, setAgeGroup] = useState(team.age_group || "");

  const saveAgeGroup = async (value) => {
    setAgeGroup(value);
    setError("");
    const { error } = await supabase.from("teams").update({ age_group: value || null }).eq("id", team.id);
    if (error) {
      setError(error.message);
      return;
    }
    onRenamed(team.id, name, value || null);
  };

  useEffect(() => {
    supabase.from("players").select("*").eq("team_id", team.id).then(({ data }) => {
      setPlayers(data || []);
      setPlayersLoading(false);
    });
  }, [team.id]);

  const saveName = async () => {
    setSaving(true);
    setError("");
    const { error } = await supabase.from("teams").update({ name }).eq("id", team.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onRenamed(team.id, name, ageGroup || null);
  };

  const deleteTeam = async () => {
    if (!confirm(`Remove ${team.name}? This can't be undone.`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) {
      setError(error.message);
      return;
    }
    onDeleted(team.id);
  };

  if (openPlayer) {
    return <ClubPlayerView player={openPlayer} onBack={() => setOpenPlayer(null)} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <button className="text-sm flex items-center gap-1" style={{ color: "var(--muted)" }} onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to teams
        </button>
        <DropdownMenu>
          {({ close }) => (
            <>
              <DropdownItem onClick={() => { setShowInviteCoach((v) => !v); close(); }}>
                {showInviteCoach ? "Hide coach invite" : "Invite a coach"}
              </DropdownItem>
              <DropdownItem onClick={() => { close(); deleteTeam(); }}>
                Remove team
              </DropdownItem>
            </>
          )}
        </DropdownMenu>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "#f28f8a" }}>{error}</p>}

      <div className="glass-panel p-6 mb-6">
        <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Team name</label>
        <div className="flex gap-2 mt-1">
          <input className="input-dark flex-1" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-accent px-4 rounded-lg" onClick={saveName} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Age group</label>
          <select
            className="w-full mt-1 rounded-lg px-2.5 py-2"
            style={{ background: "#2E4E80", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}
            value={ageGroup}
            onChange={(e) => saveAgeGroup(e.target.value)}
          >
            <option value="">Not set</option>
            {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Squad status</div>
          <div className="mt-2 font-semibold" style={{ color: team.is_full ? "#ff9a95" : "#6fe39a" }}>
            {team.is_full ? "Team full" : "Team open"}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Set by the coach on their Team page.</div>
        </div>
      </div>

      {showInviteCoach && <InviteCoach teamId={team.id} />}

      <div className="mb-6">
        <h2 className="font-display text-lg mb-3">Players</h2>
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>Read-only from the club view — coaches manage the squad.</p>
        {playersLoading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : players.length === 0 ? (
          <div className="glass-panel p-8 text-center" style={{ color: "var(--muted)" }}>No players on this team yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {sortByNumber(players).map((p) => (
              <ClubPlayerCard key={p.id} player={p} onOpen={setOpenPlayer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const RSVP_META = {
  pending: { label: "Pending", color: "var(--muted)" },
  attending: { label: "Attending", color: "#1FB65A" },
  not_attending: { label: "Not attending", color: "#E8433D" },
};

function ClubDocumentsTab({ club }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("documents").select("*").eq("club_id", club.id);
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setPendingFile({ name: file.name, url });
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  };

  const save = async () => {
    if (!pendingFile) return;
    setError("");
    const { error } = await supabase
      .from("documents")
      .insert({ club_id: club.id, title: title || pendingFile.name, file_name: pendingFile.name, file_url: pendingFile.url });
    if (error) {
      setError(error.message);
      return;
    }
    setPendingFile(null);
    setTitle("");
    load();
  };

  const remove = async (id) => {
    await supabase.from("documents").delete().eq("id", id);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-1">Club Documents</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Anything uploaded here automatically appears in every team's Documents page.
      </p>

      <div className="glass-panel p-5 mb-8">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Title</label>
            <input className="input-dark w-full mt-1" placeholder="e.g. Club handbook" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <label className="btn-ghost px-4 py-2 rounded-lg flex items-center gap-2 justify-center cursor-pointer">
            <Upload className="w-4 h-4" /> {pendingFile ? pendingFile.name : "Choose file"}
            <input type="file" className="hidden" onChange={handleFile} />
          </label>
          <button className="btn-accent px-4 py-2 rounded-lg" disabled={!pendingFile} onClick={save}>Save</button>
        </div>
        {error && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{error}</p>}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : docs.length === 0 ? (
        <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No club documents uploaded yet.</div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="glass-card p-4 flex items-center gap-3">
              <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--gold)" }} />
              <button className="flex-1 min-w-0 text-left" onClick={() => viewStoredFile(d.file_url, d.file_name)} title="Open document">
                <div className="font-medium truncate">{d.title}</div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{d.file_name}</div>
              </button>
              <button className="opacity-70 hover:opacity-100 flex-shrink-0" onClick={() => viewStoredFile(d.file_url, d.file_name)} title="View">
                <Eye className="w-4 h-4" />
              </button>
              <button className="opacity-70 hover:opacity-100 flex-shrink-0" onClick={() => downloadStoredFile(d.file_url, d.file_name)} title="Download">
                <Download className="w-4 h-4" />
              </button>
              <button className="opacity-50 hover:opacity-100 flex-shrink-0" onClick={() => remove(d.id)}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GazettePreview({ logo, shape, variant, clubName }) {
  const html = buildGazetteHtml({
    teamName: "Under 9s", clubName: clubName || "Your Club", clubLogo: logo, emblemShape: shape, variant,
    headline: "Late winner seals a thriller", body: "A brilliant team effort saw the lads come from behind to win. Every player worked hard and the supporters loved it.",
    date: new Date().toISOString().slice(0, 10), opponent: "Rivals FC", ourScore: 3, theirScore: 2,
  });
  const z = 0.27;
  return (
    <div style={{ width: GAZETTE_WIDTH * z, height: 330, overflow: "hidden", borderRadius: 8, background: "#fff" }}>
      <div style={{ zoom: z, width: GAZETTE_WIDTH }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function ClubSettingsTab({ profile, club, logo, onLogoChange, theme, onThemeChange }) {
  const shape = theme?.emblem_shape === "round" ? "round" : "square";
  const gStyle = theme?.gazette_style || "bold";
  const saveTheme = async (patch) => {
    const next = { ...(theme || {}), ...patch };
    onThemeChange(next);
    const { error } = await supabase.from("clubs").update({ theme: next }).eq("id", club.id);
    if (error) setError(error.message);
    else setSaved("Saved.");
  };
  const [name, setName] = useState(club.name || "");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const handleEmblem = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSaved("");
    setUploading(true);
    try {
      // PNG keeps a transparent background; 400px is plenty for a header badge
      const url = await resizeImage(file, 400, 0.92, "image/png");
      const { error } = await supabase.from("clubs").update({ logo_url: url }).eq("id", club.id);
      if (error) throw new Error(error.message);
      onLogoChange(url);
      setSaved("Emblem saved — it now shows on every team page.");
    } catch (err) {
      setError(err?.message || "Couldn't upload that image.");
    }
    setUploading(false);
  };

  const removeEmblem = async () => {
    setError("");
    const { error } = await supabase.from("clubs").update({ logo_url: null }).eq("id", club.id);
    if (error) {
      setError(error.message);
      return;
    }
    onLogoChange(null);
    setSaved("Emblem removed.");
  };

  const saveName = async () => {
    setSavingName(true);
    setError("");
    const { error } = await supabase.from("clubs").update({ name }).eq("id", club.id);
    setSavingName(false);
    if (error) setError(error.message);
    else {
      club.name = name;
      setSaved("Club name saved.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-6">Settings</h1>

      <div className="glass-panel p-5 mb-6">
        <h2 className="font-display text-lg mb-1">Club emblem</h2>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          Add your emblem once — it appears either side of the club name in the title bar, and is repeated on every team page for coaches and parents.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-24 h-24 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
            {logo ? <img src={logo} alt="Club emblem" className="w-full h-full" style={{ objectFit: shape === "round" ? "cover" : "contain", borderRadius: shape === "round" ? "50%" : 0 }} /> : <Camera className="w-7 h-7" style={{ color: "var(--muted)" }} />}
          </div>
          <div className="flex flex-col gap-2">
            <label className="btn-accent px-4 py-2 rounded-lg text-sm cursor-pointer text-center">
              {uploading ? "Uploading…" : logo ? "Change emblem" : "Add emblem"}
              <input type="file" accept="image/*" className="hidden" onChange={handleEmblem} disabled={uploading} />
            </label>
            {logo && <button className="btn-ghost px-4 py-2 rounded-lg text-sm" onClick={removeEmblem}>Remove</button>}
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm mb-2">Emblem shape</div>
          <div className="flex gap-2">
            {["square", "round"].map((s) => (
              <button key={s} onClick={() => saveTheme({ emblem_shape: s })}
                className={shape === s ? "btn-accent px-4 py-2 rounded-lg text-sm" : "btn-ghost px-4 py-2 rounded-lg text-sm"}>
                {s === "square" ? "Square" : "Round"}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm mt-3" style={{ color: "#f28f8a" }}>{error}</p>}
        {saved && <p className="text-sm mt-3" style={{ color: "#6fe39a" }}>{saved}</p>}
      </div>

      <div className="glass-panel p-5 mb-6">
        <h2 className="font-display text-lg mb-1">Match report style</h2>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Choose the look of the newspaper-style match report for all your teams.</p>
        <div className="flex gap-4 flex-wrap">
          {GAZETTE_STYLES.map((g) => (
            <button key={g.id} onClick={() => saveTheme({ gazette_style: g.id })} className="text-left"
              style={{ padding: 8, borderRadius: 12, border: gStyle === g.id ? "2px solid var(--accent)" : "2px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.28)" }}>
              <GazettePreview logo={logo} shape={shape} variant={g.id} clubName={club.name} />
              <div className="mt-2 text-sm font-medium">{g.label}{gStyle === g.id ? " ✓" : ""}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{g.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Club name</h2>
        <div className="flex gap-2">
          <input className="input-dark flex-1" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-accent px-4 rounded-lg" onClick={saveName} disabled={savingName || !name.trim()}>
            {savingName ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="glass-panel p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Account</h2>
        <div className="text-sm space-y-1" style={{ color: "var(--muted)" }}>
          <div>Signed in as <span style={{ color: "var(--white)" }}>{profile.display_name}</span></div>
          <div>Role: <span style={{ color: "var(--white)" }}>Club (full access)</span></div>
        </div>
      </div>

      <InviteClubAdmin clubId={club.id} />

      <div className="mt-6" />
      <ChangePasswordCard />

      <div className="glass-panel p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Privacy and terms</h2>
        <LegalLinks />
      </div>

      <DeleteAccountCard role="club" />
    </div>
  );
}

const CLUB_TABS = [
  { id: "teams", label: "Teams" },
  { id: "calendar", label: "Club Calendar" },
  { id: "announcements", label: "Announcements" },
  { id: "documents", label: "Documents" },
  { id: "settings", label: "Settings" },
];

export default function ClubDashboard({ profile, club, onSignOut }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTeamId, setOpenTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState("teams");
  const [error, setError] = useState("");
  const [logo, setLogo] = useState(club.logo_url || null);
  const [theme, setTheme] = useState(club.theme || {});
  const shape = theme.emblem_shape === "round" ? "round" : "square";

  const loadTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("teams").select("*").order("created_at", { ascending: true });
    if (!error) setTeams(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const addTeam = async () => {
    setError("");
    const { data, error } = await supabase
      .from("teams")
      .insert({ club_id: club.id, name: "New Team" })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setTeams((t) => [...t, data]);
    setOpenTeamId(data.id);
  };

  const openTeam = teams.find((t) => t.id === openTeamId);

  const header = (
    <AppHeader
      title={openTeam ? openTeam.name : club.name}
      subtitle={openTeam ? [club.name, openTeam.age_group].filter(Boolean).join(" · ") : undefined}
      logo={logo}
      shape={shape}
      onSignOut={onSignOut}
    />
  );

  if (openTeam) {
    return (
      <div className="min-h-screen">
        {header}
        <TeamDetail
          key={openTeam.id}
          team={openTeam}
          onBack={() => setOpenTeamId(null)}
          onDeleted={(id) => {
            setTeams((t) => t.filter((x) => x.id !== id));
            setOpenTeamId(null);
          }}
          onRenamed={(id, name, ageGroup) => {
            setTeams((t) => t.map((x) => (x.id === id ? { ...x, name, age_group: ageGroup } : x)));
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {header}

      <div className="flex flex-wrap gap-2 px-6 pt-4">
        {CLUB_TABS.map((t) => (
          <button
            key={t.id}
            className={activeTab === t.id ? "btn-accent px-3 py-1.5 rounded-lg text-sm" : "btn-ghost px-3 py-1.5 rounded-lg text-sm"}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calendar" ? (
        <ClubCalendarTab teams={teams} role="club" userId={profile.id} clubId={club.id} />
      ) : activeTab === "announcements" ? (
        <Announcements role="club" userId={profile.id} clubId={club.id} />
      ) : activeTab === "documents" ? (
        <ClubDocumentsTab club={club} />
      ) : activeTab === "settings" ? (
        <ClubSettingsTab profile={profile} club={club} logo={logo} onLogoChange={setLogo} theme={theme} onThemeChange={setTheme} />
      ) : (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl tracking-wide mb-6">Teams</h1>

        {error && <p className="text-sm mb-4" style={{ color: "#f28f8a" }}>{error}</p>}

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : teams.length === 0 ? (
          <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>
            No teams yet. Use the + button to create your first team.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {teams.map((t) => (
              <TeamCard key={t.id} team={t} onOpen={(team) => setOpenTeamId(team.id)} />
            ))}
          </div>
        )}

        <button
          className="fixed bottom-8 right-8 w-14 h-14 rounded-full btn-accent flex items-center justify-center"
          onClick={addTeam}
          title="Add team"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
      )}
    </div>
  );
}
