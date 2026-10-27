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

function photoBlock(label, player) {
  if (!player) return "";
  const img = player.photo_url
    ? `<img src="${esc(player.photo_url)}" alt="" style="width:130px;height:130px;object-fit:cover;display:block;border:2px solid #1a1a1a;filter:grayscale(1) contrast(1.1);" />`
    : `<div style="width:130px;height:130px;border:2px solid #1a1a1a;background:#d9cfb4;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:700;color:#6b5f3f;">${esc(initials(player.name))}</div>`;
  return `<div style="display:inline-block;text-align:center;margin:0 14px 10px 14px;vertical-align:top;">
    ${img}
    <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-top:6px;font-weight:700;">${esc(label)}</div>
    <div style="font-size:15px;font-style:italic;">${esc(player.name || "")}</div>
  </div>`;
}

export function buildGazetteHtml({
  teamName,
  clubName,
  clubLogo,
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
  const hasScore = ourScore !== null && ourScore !== undefined && theirScore !== null && theirScore !== undefined && ourScore !== "" && theirScore !== "";
  const autoHeadline = hasScore
    ? `${teamName} ${ourScore}–${theirScore} ${opponent || "Opposition"}`
    : `${teamName} v ${opponent || "Opposition"}: the match report`;
  const title = (headline || "").trim() || autoHeadline;

  const emblem = clubLogo
    ? `<img src="${esc(clubLogo)}" alt="" style="width:76px;height:76px;object-fit:contain;display:block;" />`
    : "";

  const paragraphs = String(body || "")
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => {
      const inner = esc(p).replace(/\r?\n/g, "<br/>");
      return `<p style="margin:0 0 10px 0;text-indent:${i === 0 ? "0" : "18px"};">${inner}</p>`;
    })
    .join("");

  const photos = [photoBlock("Player of the Match", potm), photoBlock("Parents' Player of the Match", parentsPotm)].join("");

  return `<div style="width:${GAZETTE_WIDTH}px;box-sizing:border-box;background:#f3ead2;color:#1a1a1a;border:4px double #1a1a1a;padding:22px 26px 18px 26px;font-family:Georgia,'Times New Roman',Times,serif;line-height:1.45;text-shadow:none;">
  <div style="border-top:3px solid #1a1a1a;border-bottom:1px solid #1a1a1a;padding:10px 0 8px 0;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="width:90px;text-align:left;vertical-align:middle;">${emblem}</td>
      <td style="text-align:center;vertical-align:middle;">
        <div style="font-size:46px;font-weight:900;letter-spacing:1px;line-height:1.05;text-transform:uppercase;font-family:'Old English Text MT','Times New Roman',Georgia,serif;">${esc(teamName)} Gazette</div>
      </td>
      <td style="width:90px;text-align:right;vertical-align:middle;"><div style="display:inline-block;">${emblem}</div></td>
    </tr></table>
  </div>
  <div style="border-bottom:3px solid #1a1a1a;padding:4px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;text-align:center;">
    ${esc(clubName || "")}${clubName ? " &#183; " : ""}Match Report${date ? " &#183; " + formatDate(date) : ""}
  </div>

  <div style="font-size:34px;line-height:1.1;text-align:center;margin:18px 0 6px 0;font-weight:900;text-transform:uppercase;">${esc(title)}</div>
  ${
    hasScore
      ? `<div style="text-align:center;font-size:20px;font-weight:700;margin:2px 0 14px 0;letter-spacing:1px;">FULL TIME: ${esc(teamName)} ${esc(ourScore)} &#8211; ${esc(theirScore)} ${esc(opponent || "")}</div>`
      : `<div style="height:10px;"></div>`
  }

  ${photos ? `<div style="text-align:center;border-top:1px solid #1a1a1a;border-bottom:1px solid #1a1a1a;padding:14px 0 6px 0;margin-bottom:14px;">${photos}</div>` : ""}

  <div style="${String(body || "").length > 700 ? "column-count:2;column-gap:26px;column-rule:1px solid #8c8466;" : ""}text-align:justify;font-size:15px;">
    ${paragraphs || `<p style="margin:0;">No report written yet.</p>`}
  </div>

  ${
    captain
      ? `<div style="margin-top:12px;padding-top:8px;border-top:1px solid #1a1a1a;font-size:13px;text-align:center;font-style:italic;">Captain on the day: <b>${esc(captain.name || "")}</b></div>`
      : ""
  }
  <div style="margin-top:10px;border-top:3px solid #1a1a1a;padding-top:4px;font-size:10px;letter-spacing:1px;text-transform:uppercase;text-align:center;">
    ${esc(teamName)} Gazette &#183; Published with ClubComms
  </div>
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
  ctx.fillStyle = "#f3ead2";
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
