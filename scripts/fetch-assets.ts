/**
 * Downloads every minimap and agent icon, downscales to webp, and rewrites the
 * generated JSON to point at local paths.
 *
 * The app has to work with no signal between rounds, so nothing may reference a
 * remote URL at runtime.
 * Run: npx tsx scripts/fetch-assets.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const ASSETS = join(ROOT, "public", "assets");

mkdirSync(join(ASSETS, "maps"), { recursive: true });
mkdirSync(join(ASSETS, "agents"), { recursive: true });
mkdirSync(join(ASSETS, "abilities"), { recursive: true });

const isRemote = (s: string) => typeof s === "string" && s.startsWith("http");

async function grab(url: string, out: string, size: number, quality = 80) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).resize(size, size, { fit: "inside" }).webp({ quality }).toFile(join(ASSETS, out));
  return `/assets/${out}`;
}

const maps = JSON.parse(readFileSync(join(DATA, "maps.generated.json"), "utf8"));
const agents = JSON.parse(readFileSync(join(DATA, "agents.generated.json"), "utf8"));

let count = 0;
for (const m of maps) {
  if (isRemote(m.minimap)) m.minimap = await grab(m.minimap, `maps/${m.id}.webp`, 1024, 84);
  if (isRemote(m.splash)) m.splash = await grab(m.splash, `maps/${m.id}-splash.webp`, 640, 72);
  count += 2;
}
for (const a of agents) {
  if (isRemote(a.icon)) a.icon = await grab(a.icon, `agents/${a.id}.webp`, 96);
  if (isRemote(a.portrait)) a.portrait = await grab(a.portrait, `agents/${a.id}-full.webp`, 320, 74);
  for (const ab of a.abilities) {
    if (!isRemote(ab.icon)) continue;
    const slug = `${a.id}-${ab.slot.toLowerCase()}`;
    ab.icon = await grab(ab.icon, `abilities/${slug}.webp`, 64);
    count++;
  }
  count += 2;
}

writeFileSync(join(DATA, "maps.generated.json"), JSON.stringify(maps, null, 2) + "\n");
writeFileSync(join(DATA, "agents.generated.json"), JSON.stringify(agents, null, 2) + "\n");
console.log(`localized ${count} assets -> public/assets`);

// App icons, generated rather than hand-drawn so there is nothing else to fetch.
const icon = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
     <rect width="512" height="512" rx="112" fill="#0b0e13"/>
     <path d="M136 356 L256 140 L376 356" fill="none" stroke="#ff4655" stroke-width="34"
           stroke-linecap="round" stroke-linejoin="round"/>
     <circle cx="256" cy="140" r="30" fill="#00e0c6"/>
   </svg>`,
);
for (const size of [192, 512]) {
  await sharp(icon).resize(size, size).png().toFile(join(ROOT, "public", `icon-${size}.png`));
}
await sharp(icon).resize(180, 180).png().toFile(join(ROOT, "public", "apple-touch-icon.png"));
console.log("wrote app icons");
