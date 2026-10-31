import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export function LegalLinks() {
  return (
    <div className="text-sm flex gap-4 flex-wrap">
      <a href="?page=privacy" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>Privacy policy</a>
      <a href="?page=terms" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>Terms of use</a>
    </div>
  );
}

export function ChangePasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const save = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (pw.length < 6) return setMsg({ type: "err", text: "Use at least 6 characters." });
    if (pw !== pw2) return setMsg({ type: "err", text: "The two passwords don't match." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ type: "err", text: error.message });
    setPw("");
    setPw2("");
    setMsg({ type: "ok", text: "Password changed." });
  };

  return (
    <div className="glass-panel p-5 mb-6">
      <h2 className="font-display text-lg mb-3">Change password</h2>
      <form onSubmit={save} className="space-y-3">
        <input type="password" className="input-dark w-full" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        <input type="password" className="input-dark w-full" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        {msg.text && <p className="text-sm" style={{ color: msg.type === "ok" ? "#6fe39a" : "#f28f8a" }}>{msg.text}</p>}
        <button type="submit" className="btn-accent px-5 py-2 rounded-lg" disabled={busy || !pw}>{busy ? "Saving…" : "Change password"}</button>
      </form>
    </div>
  );
}

export function DeleteAccountCard({ role, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const explain =
    role === "parent"
      ? "Your login is removed. Your child stays on the team list with their shirt number and match stats. If you are your child's only linked parent, their photo, name and date of birth are removed."
      : role === "coach"
      ? "Your login is removed and you leave your teams. Players, stats and match history stay with the team."
      : "Your login is removed. You can only do this if another admin has been added to the club.";

  const doDelete = async () => {
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    await supabase.auth.signOut();
    onDeleted?.();
  };

  return (
    <div className="glass-panel p-5 mb-6">
      <h2 className="font-display text-lg mb-1">Delete my account</h2>
      <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>{explain} This can't be undone.</p>
      {!open ? (
        <button className="px-4 py-2 rounded-lg text-sm" style={{ background: "#b3261e", color: "white" }} onClick={() => setOpen(true)}>
          Delete my account…
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">Type <b>DELETE</b> to confirm.</p>
          <input className="input-dark w-full" value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" />
          {error && <p className="text-sm" style={{ color: "#f28f8a" }}>{error}</p>}
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-lg text-sm disabled:opacity-40" style={{ background: "#b3261e", color: "white" }} disabled={text !== "DELETE" || busy} onClick={doDelete}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button className="btn-ghost px-4 py-2 rounded-lg text-sm" onClick={() => { setOpen(false); setText(""); setError(""); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Settings screen for coaches and parents.
export default function AccountSettings({ profile, onSignOut }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState(profile.display_name || "");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ""));
  }, []);

  const saveName = async () => {
    setSaved("");
    setError("");
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", profile.id);
    if (error) setError(error.message);
    else setSaved("Name saved.");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl tracking-wide mb-6">Settings</h1>

      <div className="glass-panel p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Your account</h2>
        <div className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          Signed in as <span style={{ color: "var(--white)" }}>{email || "…"}</span> · {profile.role === "coach" ? "Coach" : "Parent"}
        </div>
        <label className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Your name</label>
        <div className="flex gap-2 mt-1">
          <input className="input-dark flex-1" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-accent px-4 rounded-lg" onClick={saveName} disabled={!name.trim()}>Save</button>
        </div>
        {error && <p className="text-sm mt-2" style={{ color: "#f28f8a" }}>{error}</p>}
        {saved && <p className="text-sm mt-2" style={{ color: "#6fe39a" }}>{saved}</p>}
        <button className="btn-ghost px-4 py-2 rounded-lg text-sm mt-4" onClick={onSignOut}>Log out</button>
      </div>

      <ChangePasswordCard />

      <div className="glass-panel p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Privacy and terms</h2>
        <LegalLinks />
      </div>

      <DeleteAccountCard role={profile.role} />
    </div>
  );
}
