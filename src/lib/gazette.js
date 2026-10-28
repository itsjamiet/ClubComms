// Newspaper-style match report ("<Team> Gazette").
// buildGazetteHtml() returns ONE self-contained, XHTML-safe string with inline
// styles only, so the exact same markup is used for:
//   - the on-screen article,
//   - the downloadable PNG (drawn through an SVG <foreignObject>),
//   - the print / "Save as PDF" window.

export const GAZETTE_WIDTH = 760;

function esc(value) {
  return String(value ?? "")
    // strip characters that are illegal in XML so the PNG export can never fail on them
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return esc(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function initials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const GAZETTE_STYLES = [
  { id: "clean", label: "Clean", blurb: "Light and minimal" },
  { id: "bold", label: "Bold", blurb: "Dark with a big score" },
  { id: "magazine", label: "Magazine", blurb: "Colour header, sidebar" },
];

function emblemHtml(logo, shape, size, extra = "") {
  if (!logo) return "";
  const radius = shape === "round" ? "50%" : "10px";
  const fit = shape === "round" ? "cover" : "contain";
  return `<img src="${esc(logo)}" alt="" style="width:${size}px;height:${size}px;object-fit:${fit};border-radius:${radius};display:block;${extra}" />`;
}

function playerPhoto(player, size, radius, ring) {
  const border = ring ? `border:3px solid ${ring};` : "";
  if (player.photo_url) {
    return `<img src="${esc(player.photo_url)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius};display:block;margin:0 auto;${border}" />`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:${radius};background:#cfd6e6;color:#4a5878;margin:0 auto;text-align:center;line-height:${size}px;font-size:${Math.round(size / 3)}px;font-weight:700;${border}">${esc(initials(player.name))}</div>`;
}

function bodyHtml(body, color, size = 17) {
  const paras = String(body || "")
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px 0;font-size:${size}px;line-height:1.65;color:${color};">${esc(p).replace(/\r?\n/g, "<br/>")}</p>`)
    .join("");
  return paras || `<p style="margin:0;color:${color};">No report written yet.</p>`;
}

export function buildGazetteHtml({
  teamName: rawTeamName,
  clubName,
  clubLogo,
  emblemShape = "square",
  variant = "clean",
  headline,
  body,
  date,
  opponent,
  ourScore,
  theirScore,
  captain,
  potm,
  parentsPotm,
}) {
  const teamName = (String(rawTeamName || "").replace(/\s*\bU[-\s]?\d{1,2}('?s)?\b/gi, "").trim()) || rawTeamName || "";
  const hasScore = ourScore !== null && ourScore !== undefined && theirScore !== null && theirScore !== undefined && ourScore !== "" && theirScore !== "";
  const autoHeadline = hasScore
    ? `${teamName} ${ourScore}–${theirScore} ${opponent || "Opposition"}`
    : `${teamName} v ${opponent || "Opposition"}`;
  const title = (headline || "").trim() || autoHeadline;
  const dateLine = [clubName, date ? formatDate(date) : ""].filter(Boolean).map(esc).join(" &#183; ");
  const W = GAZETTE_WIDTH;
  const base = `width:${W}px;box-sizing:border-box;font-family:${SANS};text-shadow:none;`;

  // ---------------- BOLD (dark) ----------------
  if (variant === "bold") {
    const award = (label, pl) =>
      pl
        ? `<td style="text-align:center;padding:0 18px;vertical-align:top;">${playerPhoto(pl, 120, "50%", "#f5c542")}<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#f5c542;margin-top:10px;font-weight:700;">${esc(label)}</div><div style="font-size:16px;color:#ffffff;font-weight:600;margin-top:2px;">${esc(pl.name || "")}</div></td>`
        : "";
    const awards = award("Player of the match", potm) + award("Parents' player", parentsPotm);
    return `<div style="${base}background:#06143a;color:#ffffff;padding:40px 44px 28px 44px;border-radius:0;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="vertical-align:top;">
      <div style="font-size:26px;letter-spacing:4px;text-transform:uppercase;color:#f5c542;font-weight:800;">${esc(teamName)} Gazette</div>
      <div style="font-size:13px;color:#9fb0d4;margin-top:6px;">${dateLine}</div>
    </td>
    <td style="width:132px;vertical-align:top;text-align:right;">${emblemHtml(clubLogo, emblemShape, 120, "margin-left:auto;")}</td>
  </tr></table>
  ${
    hasScore
      ? `<div style="text-align:center;margin:30px 0 4px 0;font-size:104px;font-weight:900;line-height:1;letter-spacing:-2px;">${esc(ourScore)}<span style="color:#f5c542;"> – </span>${esc(theirScore)}</div>
         <div style="text-align:center;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#9fb0d4;">${esc(teamName)} v ${esc(opponent || "Opposition")}</div>`
      : ""
  }
  <div style="font-size:36px;font-weight:800;line-height:1.15;margin:28px 0 22px 0;text-align:${hasScore ? "center" : "left"};">${esc(title)}</div>
  ${awards ? `<table style="margin:0 auto 26px auto;border-collapse:collapse;"><tr>${awards}</tr></table>` : ""}
  <div style="border-top:1px solid #1f3270;padding-top:24px;">${bodyHtml(body, "#e6ecfa")}</div>
  ${captain ? `<div style="margin-top:6px;font-size:14px;color:#9fb0d4;">Captain: <span style="color:#ffffff;font-weight:700;">${esc(captain.name || "")}</span></div>` : ""}
  <div style="margin-top:26px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6f82b3;text-align:center;">Published with ClubComms</div>
</div>`;
  }

  // ---------------- MAGAZINE (colour band + sidebar) ----------------
  if (variant === "magazine") {
    const side = (label, pl) =>
      pl
        ? `<div style="text-align:center;margin-bottom:22px;">${playerPhoto(pl, 118, "50%", "#ffffff")}<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1f5fd6;margin-top:10px;font-weight:800;">${esc(label)}</div><div style="font-size:16px;font-weight:700;color:#0b1a3d;">${esc(pl.name || "")}</div></div>`
        : "";
    return `<div style="${base}background:#ffffff;color:#0b1a3d;">
  <div style="background:#1f5fd6;color:#ffffff;padding:30px 44px 26px 44px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:middle;">
        <div style="font-size:26px;letter-spacing:4px;text-transform:uppercase;font-weight:800;color:#ffffff;">${esc(teamName)} Gazette</div>
        <div style="font-size:13px;margin-top:4px;color:#d6e3fb;">${dateLine}</div>
      </td>
      <td style="width:136px;vertical-align:middle;text-align:right;">${emblemHtml(clubLogo, emblemShape, 124, "margin-left:auto;background:#ffffff;padding:4px;box-sizing:border-box;")}</td>
    </tr></table>
    <div style="font-size:40px;font-weight:800;line-height:1.1;margin-top:20px;">${esc(title)}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:230px;background:#eef3fc;padding:28px 20px;vertical-align:top;">
      ${
        hasScore
          ? `<div style="text-align:center;margin-bottom:24px;"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#1f5fd6;font-weight:800;">Full time</div><div style="font-size:56px;font-weight:900;line-height:1.05;">${esc(ourScore)}–${esc(theirScore)}</div><div style="font-size:13px;color:#4a5878;">${esc(teamName)} v ${esc(opponent || "Opposition")}</div></div>`
          : ""
      }
      ${side("Player of the match", potm)}${side("Parents' player of the match", parentsPotm)}
      ${captain ? `<div style="text-align:center;font-size:13px;color:#4a5878;">Captain<div style="font-size:16px;font-weight:700;color:#0b1a3d;">${esc(captain.name || "")}</div></div>` : ""}
    </td>
    <td style="padding:28px 44px 24px 32px;vertical-align:top;">${bodyHtml(body, "#1b2a4d", 16)}</td>
  </tr></table>
  <div style="border-top:1px solid #dbe3f3;padding:12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7b88a8;text-align:center;">Published with ClubComms</div>
</div>`;
  }

  // ---------------- CLEAN (light, default) ----------------
  const card = (label, pl) =>
    pl
      ? `<td style="text-align:center;padding:0 12px 0 0;vertical-align:top;width:170px;">${playerPhoto(pl, 150, "16px", "")}<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1f5fd6;margin-top:10px;font-weight:800;">${esc(label)}</div><div style="font-size:16px;font-weight:700;color:#111111;">${esc(pl.name || "")}</div></td>`
      : "";
  const cards = card("Player of the match", potm) + card("Parents' player of the match", parentsPotm);
  return `<div style="${base}background:#ffffff;color:#111111;padding:40px 44px 28px 44px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="vertical-align:top;">
      <div style="font-size:26px;letter-spacing:4px;text-transform:uppercase;color:#1f5fd6;font-weight:800;">${esc(teamName)} Gazette</div>
      <div style="width:48px;height:4px;background:#1f5fd6;margin:12px 0 10px 0;"></div>
      <div style="font-size:13px;color:#6b7488;">${dateLine}</div>
    </td>
    <td style="width:132px;vertical-align:top;text-align:right;">${emblemHtml(clubLogo, emblemShape, 120, "margin-left:auto;")}</td>
  </tr></table>
  <div style="font-size:42px;font-weight:800;line-height:1.1;margin:28px 0 14px 0;letter-spacing:-0.5px;">${esc(title)}</div>
  ${hasScore ? `<div style="display:inline-block;background:#f1f4fa;border-radius:10px;padding:8px 16px;font-size:17px;font-weight:700;margin-bottom:24px;">FT &#160; ${esc(teamName)} ${esc(ourScore)} – ${esc(theirScore)} ${esc(opponent || "")}</div>` : `<div style="height:10px;"></div>`}
  ${cards ? `<table style="border-collapse:collapse;margin:4px 0 26px 0;"><tr>${cards}</tr></table>` : ""}
  ${bodyHtml(body, "#222222")}
  ${captain ? `<div style="margin-top:4px;font-size:14px;color:#6b7488;">Captain: <span style="color:#111111;font-weight:700;">${esc(captain.name || "")}</span></div>` : ""}
  <div style="margin-top:28px;border-top:1px solid #e3e7f0;padding-top:12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9aa3b8;">Published with ClubComms</div>
</div>`;
}

function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })))
  );
}

// Renders the article to a PNG blob (2x for sharpness).
export async function gazetteToPngBlob(html) {
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${GAZETTE_WIDTH}px;`;
  holder.innerHTML = html;
  document.body.appendChild(holder);
  await waitForImages(holder);
  const height = Math.ceil(holder.firstElementChild.getBoundingClientRect().height);
  holder.remove();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GAZETTE_WIDTH}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Couldn't draw the article."));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = GAZETTE_WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, GAZETTE_WIDTH, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image."))), "image/png");
  });
}

export async function downloadGazettePng(html, fileName) {
  const blob = await gazetteToPngBlob(html);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(fileName || "match-report").replace(/[^\w\- ]+/g, "").trim() || "match-report"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Opens the article in its own window and triggers the print dialog (choose "Save as PDF").
export function printGazette(html, title) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title || "Gazette")}</title>
    <style>body{margin:0;padding:16px;background:#fff;display:flex;justify-content:center;} @page{margin:10mm;}</style></head>
    <body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script></body></html>`
  );
  w.document.close();
  return true;
}
