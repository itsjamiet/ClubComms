import { useEffect, useState } from "react";
import { Upload, FileText, Trash2, Eye, Download } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { fileToDataUrl, viewStoredFile, downloadStoredFile } from "../lib/utils.js";

export default function DocumentsView({ team, editable }) {
  const [clubDocs, setClubDocs] = useState([]);
  const [teamDocs, setTeamDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: t } = await supabase.from("teams").select("club_id").eq("id", team.id).single();
    const clubId = t?.club_id;
    const [{ data: cd }, { data: td }] = await Promise.all([
      clubId ? supabase.from("documents").select("*").eq("club_id", clubId) : Promise.resolve({ data: [] }),
      supabase.from("documents").select("*").eq("team_id", team.id),
    ]);
    setClubDocs(cd || []);
    setTeamDocs(td || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

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
      .insert({ team_id: team.id, title: title || pendingFile.name, file_name: pendingFile.name, file_url: pendingFile.url });
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
      <h1 className="font-display text-2xl tracking-wide mb-6">Documents</h1>

      {editable && (
        <div className="glass-panel p-5 mb-8">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Title</label>
              <input className="input-dark w-full mt-1" placeholder="e.g. Season fixtures" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <label className="btn-ghost px-4 py-2 rounded-lg flex items-center gap-2 justify-center cursor-pointer">
              <Upload className="w-4 h-4" /> {pendingFile ? pendingFile.name : "Choose file"}
              <input type="file" className="hidden" onChange={handleFile} />
            </label>
            <button className="btn-accent px-4 py-2 rounded-lg" disabled={!pendingFile} onClick={save}>Save</button>
          </div>
          {error && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{error}</p>}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : (
        <>
          {clubDocs.length > 0 && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>From your club</div>
              <div className="space-y-2">
                {clubDocs.map((d) => (
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
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(212,175,55,0.15)", color: "var(--gold-light)" }}>Club</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {teamDocs.length === 0 && clubDocs.length === 0 ? (
            <div className="glass-panel p-10 text-center" style={{ color: "var(--muted)" }}>No documents uploaded yet.</div>
          ) : (
            teamDocs.length > 0 && (
              <div className="space-y-2">
                {teamDocs.map((d) => (
                  <div key={d.id} className="glass-card p-4 flex items-center gap-3">
                    <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--accent)" }} />
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
                    {editable && (
                      <button className="opacity-50 hover:opacity-100 flex-shrink-0" onClick={() => remove(d.id)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
