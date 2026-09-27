/**
 * Investigates whether the minimap art can act as a walkable mask, so paths can
 * follow corridors instead of cutting straight lines between sparse callouts.
 * Run: npx tsx scripts/probe-navmesh.ts
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const maps = JSON.parse(readFileSync(join(ROOT, "src/data/maps.generated.json"), "utf8"));

async function probe(id: string) {
  const rec = maps.find((m: any) => m.id === id);
  const file = join(ROOT, "public", rec.minimap);
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  let opaque = 0, transp = 0, mid = 0;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a > 200) opaque++;
    else if (a < 40) transp++;
    else mid++;
  }

  let on = 0;
  const off: string[] = [];
  for (const c of rec.callouts) {
    const px = Math.min(info.width - 1, Math.round(c.x * info.width));
    const py = Math.min(info.height - 1, Math.round(c.y * info.height));
    const a = data[(py * info.width + px) * 4 + 3];
    if (a > 100) on++;
    else off.push(`${c.name}(a=${a})`);
  }

  console.log(
    `${rec.name.padEnd(9)} ${meta.width}x${meta.height} alpha=${meta.hasAlpha}  ` +
    `opaque ${(opaque / n * 100).toFixed(0)}%  transp ${(transp / n * 100).toFixed(0)}%  partial ${(mid / n * 100).toFixed(0)}%  ` +
    `callouts on-mask ${on}/${rec.callouts.length}`,
  );
  if (off.length) console.log(`          off-mask: ${off.join(", ")}`);
}

for (const m of maps) await probe(m.id);
