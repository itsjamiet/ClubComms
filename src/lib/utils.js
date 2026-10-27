// Shared helpers used across the app.

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Formats a Date using its LOCAL calendar day, never toISOString() (which
// converts to UTC first and can roll the date back a day in BST).
export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Shrinks + re-encodes a photo (iPhone photos can be huge / HEIC).
// type "image/png" keeps transparency (used for the club emblem).
export function resizeImage(file, maxDimension = 800, quality = 0.85, type = "image/jpeg") {
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
        if (type === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(type, quality));
      };
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Age in whole years from a YYYY-MM-DD date of birth.
export function calcAge(dob) {
  if (!dob) return null;
  const [y, m, d] = String(dob).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

// What to show as the player's age: from date of birth if known, else the typed age.
export function displayAge(player) {
  const fromDob = calcAge(player?.date_of_birth);
  if (fromDob !== null) return fromDob;
  return player?.age || "—";
}

export const AGE_GROUPS = ["U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16"];

// ---- Match awards <-> weekly stats -------------------------------------
// Weekly stat entries are linked to a match by eventId (new entries) or,
// for older entries, by date (+ opponent when several share a date).
export function findStatIndex(stats, event) {
  if (!event) return -1;
  const byId = stats.findIndex((s) => s.eventId && s.eventId === event.id);
  if (byId >= 0) return byId;
  const sameDate = stats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.eventId && s.date === event.date);
  if (sameDate.length === 0) return -1;
  const opp = (event.opponent || "").trim().toLowerCase();
  const exact = sameDate.find(({ s }) => (s.opponent || "").trim().toLowerCase() === opp);
  return (exact || sameDate[0]).i;
}

export function awardsForStat(stat) {
  const out = [];
  if (stat?.captain) out.push("Captain");
  if (stat?.potm) out.push("Player of the match");
  if (stat?.parentsPotm) out.push("Parents' player of the match");
  return out;
}

export function statTotals(stats) {
  const goalsTotal = stats.reduce((s, x) => s + (Number(x.goals) || 0), 0);
  const savesTotal = stats.reduce((s, x) => s + (Number(x.saves) || 0), 0);
  const tacklesTotal = stats.reduce((s, x) => s + (Number(x.tackles) || 0), 0);
  const captainTotal = stats.filter((x) => x.captain).length;
  const potmTotal = stats.filter((x) => x.potm).length;
  const parentsPotmTotal = stats.filter((x) => x.parentsPotm).length;
  const minutesPlayedTotal = stats.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  const matchMinutesTotal = stats.reduce((s, x) => s + (Number(x.matchMinutes) || 0), 0);
  const minutesPct = matchMinutesTotal > 0 ? Math.round((minutesPlayedTotal / matchMinutesTotal) * 100) : null;
  return { goalsTotal, savesTotal, tacklesTotal, captainTotal, potmTotal, parentsPotmTotal, minutesPct };
}

// Opens a stored (data URL) file in a new tab so it can be viewed.
// Data URLs are blocked as direct links in most browsers, so we convert
// to a temporary blob URL first. Falls back to downloading.
export async function viewStoredFile(dataUrl, fileName) {
  const win = window.open("", "_blank");
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    if (win) {
      win.location.href = url;
    } else {
      downloadBlobUrl(url, fileName);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    if (win) win.close();
    downloadStoredFile(dataUrl, fileName);
  }
}

function downloadBlobUrl(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "document";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadStoredFile(dataUrl, fileName) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    downloadBlobUrl(url, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    downloadBlobUrl(dataUrl, fileName);
  }
}
