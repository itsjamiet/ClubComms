import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { toDateString } from "./utils.js";

// In-app alerts: red badges on the Announcements and Club Calendar tabs.
//  - announcements: posted since you last opened the Announcements tab
//  - events: upcoming club events you haven't answered yet
// (Real phone push notifications come later with the native app wrapper.)
export function useAlertCounts(userId, enabled = true) {
  const [counts, setCounts] = useState({ announcements: 0, events: 0 });

  const refresh = useCallback(async () => {
    if (!userId || !enabled) return;
    try {
      const [{ data: seen }, { data: anns }, { data: evs }, { data: resps }] = await Promise.all([
        supabase.from("announcement_seen").select("last_seen").eq("user_id", userId).maybeSingle(),
        supabase.from("announcements").select("id, created_at, created_by"),
        supabase.from("club_events").select("id").gte("date", toDateString(new Date())),
        supabase.from("club_event_responses").select("event_id").eq("user_id", userId),
      ]);
      const lastSeen = seen?.last_seen ? new Date(seen.last_seen).getTime() : 0;
      const newAnns = (anns || []).filter((a) => a.created_by !== userId && new Date(a.created_at).getTime() > lastSeen).length;
      const answered = new Set((resps || []).map((r) => r.event_id));
      const pendingEvents = (evs || []).filter((e) => !answered.has(e.id)).length;
      setCounts({ announcements: newAnns, events: pendingEvents });
    } catch (e) {
      /* alerts are best-effort */
    }
  }, [userId, enabled]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const markAnnouncementsSeen = useCallback(async () => {
    if (!userId) return;
    await supabase.from("announcement_seen").upsert({ user_id: userId, last_seen: new Date().toISOString() });
    setCounts((c) => ({ ...c, announcements: 0 }));
  }, [userId]);

  return { counts, refresh, markAnnouncementsSeen };
}
