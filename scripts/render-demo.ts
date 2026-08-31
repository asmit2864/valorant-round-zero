/**
 * Renders a self-contained HTML preview of the top strategies for a comp.
 * Proves the blueprint pipeline end to end: set piece -> matcher -> A* route -> SVG.
 * Run: npx tsx scripts/render-demo.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { buildGraph } from "../src/lib/graph";
import { rankStrategies, type RankedStrategy } from "../src/lib/matcher";
import { ASCENT_SET_PIECES } from "../src/data/setpieces/ascent";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const maps = read("../src/data/maps.generated.json");
const agents = read("../src/data/agents.generated.json");
const ascent = maps.find((m: any) => m.id === "ascent");
const g = buildGraph(read("../src/data/graphs/ascent.json"), ascent.callouts);

const ALLIES = ["jett", "omen", "sova", "killjoy", "kay-o"];
const ENEMIES = ["viper", "cypher", "raze", "skye", "chamber"];
const SIDE = "attack" as const;

/** Downscale before embedding - the source art is 2K+ and we only need it inline. */
async function dataUri(url: string, size: number): Promise<string> {
  const res = await fetch(url);
  const raw = Buffer.from(await res.arrayBuffer());
  const out = await sharp(raw).resize(size, size, { fit: "inside" }).webp({ quality: 82 }).toBuffer();
  return `data:image/webp;base64,${out.toString("base64")}`;
}

const LANE = ["#ff4655", "#00e0c6", "#ffb648", "#8b7bff", "#4ade80"];

/** Catmull-Rom through the route points, so paths curve like a drawn diagram. */
function smoothPath(pts: { x: number; y: number }[], S = 1000): string {
  const p = pts.map((n) => ({ x: n.x * S, y: n.y * S }));
  if (p.length < 2) return "";
  if (p.length === 2) return `M${p[0].x},${p[0].y} L${p[1].x},${p[1].y}`;
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6}` +
         ` ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6}` +
         ` ${p2.x},${p2.y}`;
  }
  return d;
}

function blueprint(s: RankedStrategy, icons: Record<string, string>): string {
  const routes = s.assignments.map((a, i) => {
    if (!a.route.length) return "";
    const color = LANE[i % LANE.length];
    const d = smoothPath(a.route);
    const end = a.route[a.route.length - 1];
    const start = a.route[0];
    const icon = a.agent ? icons[a.agent] : null;
    return `
      <path d="${d}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="9" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="14 10" opacity=".95">
        <animate attributeName="stroke-dashoffset" from="48" to="0" dur="1.4s" repeatCount="indefinite"/>
      </path>
      <circle cx="${start.x * 1000}" cy="${start.y * 1000}" r="7" fill="${color}" opacity=".6"/>
      <circle cx="${end.x * 1000}" cy="${end.y * 1000}" r="21" fill="${color}"/>
      ${icon ? `<clipPath id="c${s.piece.id}${i}"><circle cx="${end.x * 1000}" cy="${end.y * 1000}" r="19"/></clipPath>
        <image href="${icon}" x="${end.x * 1000 - 19}" y="${end.y * 1000 - 19}" width="38" height="38"
               clip-path="url(#c${s.piece.id}${i})"/>` : ""}
      <circle cx="${end.x * 1000}" cy="${end.y * 1000}" r="21" fill="none" stroke="#0b0e13" stroke-width="3"/>`;
  }).join("");

  return `<svg viewBox="0 0 1000 1000" class="bp">
    <rect width="1000" height="1000" fill="#0b0e13" opacity=".35"/>
    ${routes}
  </svg>`;
}

const ranked = rankStrategies(g, ASCENT_SET_PIECES, ALLIES, ENEMIES, SIDE, 3);
const minimap = await dataUri(ascent.minimap, 900);
const icons: Record<string, string> = {};
for (const id of [...ALLIES, ...ENEMIES]) {
  const a = agents.find((x: any) => x.id === id);
  if (a?.icon) icons[id] = await dataUri(a.icon, 64);
}
const nameOf = (id: string) => agents.find((a: any) => a.id === id)?.name ?? id;

const cards = ranked.map((s, idx) => `
  <article class="card">
    <header>
      <span class="rank">${idx + 1} of ${ranked.length}</span>
      <h2>${s.piece.name}</h2>
      <p class="premise">${s.piece.premise}</p>
      <div class="meta">
        <span class="pill fit">fit ${(s.fit * 100).toFixed(0)}%</span>
        <span class="pill ${s.counter >= 0 ? "good" : "bad"}">matchup ${s.counter >= 0 ? "+" : ""}${(s.counter * 100).toFixed(0)}%</span>
        <span class="pill">${"●".repeat(s.piece.difficulty)}${"○".repeat(3 - s.piece.difficulty)} difficulty</span>
      </div>
    </header>
    <div class="bpwrap">${blueprint(s, icons)}</div>
    <ol class="roles">
      ${s.assignments.map((a, i) => `
        <li style="--lane:${LANE[i % LANE.length]}">
          <div class="who">
            ${a.agent ? `<img src="${icons[a.agent]}" alt="">` : `<span class="gap">!</span>`}
            <strong>${a.agent ? nameOf(a.agent) : "UNFILLED"}</strong>
            <em>${a.slot.label}</em>
          </div>
          <p class="note">${a.gap ?? a.slot.note}</p>
          <p class="route">${a.route.map((n) => n.name).join(" → ")}</p>
          ${(a.slot.util ?? []).map((u) => `<p class="util"><b>${u.tag}</b> from ${u.at} → ${u.target}${u.note ? ` — ${u.note}` : ""}</p>`).join("")}
        </li>`).join("")}
    </ol>
    <section class="watch">
      <h3>Watch out for</h3>
      ${s.watchOut.map((w) => `<p><strong>${nameOf(w.agent)}</strong> ${w.note}</p>`).join("")}
    </section>
  </article>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ascent Blueprint Preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0b0e13; color:#e7ecf3;
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  .wrap { max-width:520px; margin:0 auto; padding:16px 14px 48px; }
  .head { padding:8px 2px 18px; }
  .head h1 { margin:0 0 4px; font-size:19px; letter-spacing:-.2px; }
  .head p { margin:0; color:#8b97a8; font-size:13px; }
  .teams { display:flex; gap:8px; align-items:center; margin-top:12px; flex-wrap:wrap; }
  .teams img { width:30px; height:30px; border-radius:8px; background:#161b24; }
  .vs { color:#5b6676; font-size:12px; font-weight:700; padding:0 2px; }
  .card { background:#111722; border:1px solid #1e2735; border-radius:16px;
          overflow:hidden; margin-bottom:20px; }
  .card header { padding:16px 16px 12px; }
  .rank { font-size:11px; color:#5b6676; letter-spacing:.08em; text-transform:uppercase; }
  .card h2 { margin:6px 0 4px; font-size:19px; letter-spacing:-.3px; }
  .premise { margin:0 0 12px; color:#9aa7b8; font-size:13.5px; }
  .meta { display:flex; gap:6px; flex-wrap:wrap; }
  .pill { font-size:11px; padding:4px 9px; border-radius:99px; background:#1a2231; color:#9aa7b8; }
  .pill.fit { background:#132a20; color:#4ade80; }
  .pill.good { background:#132a20; color:#4ade80; }
  .pill.bad { background:#2a1518; color:#ff6b74; }
  .bpwrap { background:#080b10 center/cover no-repeat; background-image:var(--minimap); }
  .bp { display:block; width:100%; height:auto; }
  .roles { list-style:none; margin:0; padding:8px 0 0; }
  .roles li { padding:12px 16px; border-top:1px solid #1a2231; border-left:3px solid var(--lane); }
  .who { display:flex; align-items:center; gap:8px; }
  .who img { width:26px; height:26px; border-radius:7px; background:#161b24; }
  .who strong { font-size:14px; }
  .who em { font-style:normal; font-size:11px; color:#5b6676; text-transform:uppercase;
            letter-spacing:.06em; margin-left:auto; }
  .gap { width:26px; height:26px; border-radius:7px; background:#3a1d20; color:#ff6b74;
         display:grid; place-items:center; font-weight:700; }
  .note { margin:7px 0 0; font-size:13px; color:#c2ccd9; }
  .route { margin:6px 0 0; font-size:11px; color:#5b6676; font-family:ui-monospace,monospace; }
  .util { margin:5px 0 0; font-size:11.5px; color:#7f8ea3; }
  .util b { color:#00e0c6; font-weight:600; }
  .watch { padding:14px 16px 16px; background:#0d1219; border-top:1px solid #1a2231; }
  .watch h3 { margin:0 0 8px; font-size:11px; color:#5b6676; letter-spacing:.08em;
              text-transform:uppercase; }
  .watch p { margin:0 0 6px; font-size:12.5px; color:#9aa7b8; }
  .watch strong { color:#ff8f96; }
</style></head><body><div class="wrap" style="--minimap:url('${minimap}')">
  <div class="head">
    <h1>Ascent · Attack</h1>
    <p>${ranked.length} strategies, ranked for your comp against theirs</p>
    <div class="teams">
      ${ALLIES.map((a) => `<img src="${icons[a]}" title="${nameOf(a)}">`).join("")}
      <span class="vs">VS</span>
      ${ENEMIES.map((a) => `<img src="${icons[a]}" title="${nameOf(a)}">`).join("")}
    </div>
  </div>
  ${cards}
</div></body></html>`;

writeFileSync(new URL("../preview-ascent.html", import.meta.url), html);
console.log(`wrote preview-ascent.html (${(html.length / 1024).toFixed(0)} KB), ${ranked.length} strategies`);
