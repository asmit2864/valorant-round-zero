/**
 * Precomputes a corridor polyline for every edge in a map's graph.
 *
 * The callout graph knows which places connect, but a straight line between two
 * callouts cuts through walls -- callouts are sparse (22 on Ascent) and rooms
 * are not convex. Riot's minimap art has an alpha channel that is effectively a
 * walkable mask, so we grid-search through it and store the resulting shape.
 *
 * Done at build time: the app ships the polylines and stays instant and offline.
 *
 * Run: npx tsx scripts/build-routes.ts [mapId]
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "routes");
const GRID = 256;             // navgrid resolution; 1024 art downsamples cleanly
const ALPHA_WALKABLE = 100;   // alpha above this counts as floor
const CLEARANCE = 6;          // cells; how far from a wall a path prefers to stay

type Pt = { x: number; y: number };

function buildMask(alpha: Uint8Array): Uint8Array {
  const mask = new Uint8Array(GRID * GRID);
  for (let i = 0; i < mask.length; i++) mask[i] = alpha[i] > ALPHA_WALKABLE ? 1 : 0;
  return mask;
}

/**
 * Chebyshev distance to the nearest wall, by two-pass sweep. Used to keep paths
 * off the walls: hugging geometry looks wrong even when it is technically legal.
 */
function clearanceField(mask: Uint8Array): Int32Array {
  const d = new Int32Array(GRID * GRID);
  const BIG = 1 << 20;
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? BIG : 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      if (!mask[i]) continue;
      let best = d[i];
      if (x > 0) best = Math.min(best, d[i - 1] + 1);
      if (y > 0) best = Math.min(best, d[i - GRID] + 1);
      if (x > 0 && y > 0) best = Math.min(best, d[i - GRID - 1] + 1);
      if (x < GRID - 1 && y > 0) best = Math.min(best, d[i - GRID + 1] + 1);
      d[i] = best;
    }
  }
  for (let y = GRID - 1; y >= 0; y--) {
    for (let x = GRID - 1; x >= 0; x--) {
      const i = y * GRID + x;
      if (!mask[i]) continue;
      let best = d[i];
      if (x < GRID - 1) best = Math.min(best, d[i + 1] + 1);
      if (y < GRID - 1) best = Math.min(best, d[i + GRID] + 1);
      if (x < GRID - 1 && y < GRID - 1) best = Math.min(best, d[i + GRID + 1] + 1);
      if (x > 0 && y < GRID - 1) best = Math.min(best, d[i + GRID - 1] + 1);
      d[i] = best;
    }
  }
  return d;
}

/** Nearest walkable cell, for callouts that sit a pixel or two off the art. */
function snap(mask: Uint8Array, p: Pt): number | null {
  const cx = Math.round(p.x * (GRID - 1));
  const cy = Math.round(p.y * (GRID - 1));
  for (let r = 0; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
        if (mask[y * GRID + x]) return y * GRID + x;
      }
    }
  }
  return null;
}

const NEIGHBOURS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

function gridAStar(mask: Uint8Array, clear: Int32Array, from: number, to: number): number[] | null {
  const g = new Float64Array(GRID * GRID).fill(Infinity);
  const came = new Int32Array(GRID * GRID).fill(-1);
  const open: number[] = [from];
  const f = new Float64Array(GRID * GRID).fill(Infinity);
  const tx = to % GRID, ty = (to / GRID) | 0;
  const h = (i: number) => Math.hypot((i % GRID) - tx, ((i / GRID) | 0) - ty);

  g[from] = 0;
  f[from] = h(from);
  const inOpen = new Uint8Array(GRID * GRID);
  inOpen[from] = 1;

  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open.splice(bi, 1)[0];
    inOpen[cur] = 0;
    if (cur === to) {
      const path = [cur];
      let c = cur;
      while (came[c] !== -1) { c = came[c]; path.unshift(c); }
      return path;
    }
    const cx = cur % GRID, cy = (cur / GRID) | 0;
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      const ni = y * GRID + x;
      if (!mask[ni]) continue;
      // Diagonals may not cut a corner between two walls.
      if (dx && dy && (!mask[cy * GRID + x] || !mask[y * GRID + cx])) continue;
      // Penalise walking close to walls so routes sit in the middle of corridors.
      const penalty = Math.max(0, CLEARANCE - clear[ni]) * 0.6;
      const tentative = g[cur] + cost + penalty;
      if (tentative < g[ni]) {
        g[ni] = tentative;
        came[ni] = cur;
        f[ni] = tentative + h(ni);
        if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
      }
    }
  }
  return null;
}

/** True when every cell on the segment is walkable -- used to drop redundant points. */
function clearLine(mask: Uint8Array, a: number, b: number): boolean {
  const ax = a % GRID, ay = (a / GRID) | 0;
  const bx = b % GRID, by = (b / GRID) | 0;
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(ax + ((bx - ax) * s) / steps);
    const y = Math.round(ay + ((by - ay) * s) / steps);
    if (!mask[y * GRID + x]) return false;
  }
  return true;
}

/** String-pulling: keep only the corners the corridor actually forces. */
function simplify(mask: Uint8Array, path: number[]): number[] {
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !clearLine(mask, path[i], path[j])) j--;
    out.push(path[j]);
    i = j;
  }
  return out;
}

const toNorm = (i: number): [number, number] => [
  Math.round(((i % GRID) / (GRID - 1)) * 10000) / 10000,
  Math.round((((i / GRID) | 0) / (GRID - 1)) * 10000) / 10000,
];

async function build(mapId: string) {
  const maps = JSON.parse(readFileSync(join(ROOT, "src/data/maps.generated.json"), "utf8"));
  const rec = maps.find((m: any) => m.id === mapId);
  const raw = JSON.parse(readFileSync(join(ROOT, `src/data/graphs/${mapId}.json`), "utf8"));

  const { data } = await sharp(join(ROOT, "public", rec.minimap))
    .resize(GRID, GRID, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(GRID * GRID);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];

  const mask = buildMask(alpha);
  const clear = clearanceField(mask);

  const nodes = new Map<string, Pt>();
  for (const c of rec.callouts) nodes.set(c.name, { x: c.x, y: c.y });
  for (const n of raw.extraNodes ?? []) nodes.set(n.name, { x: n.x, y: n.y });

  const cells = new Map<string, number>();
  const unsnappable: string[] = [];
  for (const [name, p] of nodes) {
    const c = snap(mask, p);
    if (c === null) unsnappable.push(name);
    else cells.set(name, c);
  }

  const routes: Record<string, [number, number][]> = {};
  const failed: string[] = [];
  const straight: string[] = [];
  const detours: string[] = [];

  for (const edge of raw.edges) {
    const [a, b] = edge as [string, string];
    const ca = cells.get(a), cb = cells.get(b);
    if (ca === undefined || cb === undefined) { failed.push(`${a} -> ${b} (node off the walkable mask)`); continue; }
    const path = gridAStar(mask, clear, ca, cb);
    if (!path) { failed.push(`${a} -> ${b} (no walkable route: edge is probably wrong)`); continue; }
    const pts = simplify(mask, path).map(toNorm);
    routes[`${a}|${b}`] = pts;
    routes[`${b}|${a}`] = [...pts].reverse();
    if (pts.length === 2) straight.push(`${a} -> ${b}`);

    // A walkable route far longer than the straight line means these two
    // callouts are not actually adjacent -- the search went the long way round.
    const walked = pts.slice(1).reduce((n, p, k) => n + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
    const direct = Math.hypot(nodes.get(a)!.x - nodes.get(b)!.x, nodes.get(a)!.y - nodes.get(b)!.y);
    const ratio = direct > 0.001 ? walked / direct : 1;
    if (ratio > 1.8) detours.push(`${a} -> ${b}  (walks ${ratio.toFixed(1)}x the direct distance)`);
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${mapId}.json`), JSON.stringify(routes) + "\n");

  const edgeCount = raw.edges.length;
  console.log(`\n${rec.name}`);
  console.log(`  nodes snapped   : ${cells.size}/${nodes.size}`);
  if (unsnappable.length) console.log(`  OFF-MASK NODES  : ${unsnappable.join(", ")}`);
  console.log(`  edges routed    : ${edgeCount - failed.length}/${edgeCount}`);
  console.log(`  bends added     : ${Object.keys(routes).length / 2 - straight.length} of ${edgeCount} edges curve around geometry`);
  if (detours.length) {
    console.log(`  SUSPECT EDGES (${detours.length}) -- routable, but not directly adjacent:`);
    for (const d of detours) console.log(`      ${d}`);
  }
  if (failed.length) {
    console.log(`  UNROUTABLE EDGES (${failed.length}) -- these are graph errors:`);
    for (const f of failed) console.log(`      ${f}`);
  }
  return failed.length;
}

const only = process.argv[2];
const ids = only ? [only] : ["ascent"];
let bad = 0;
for (const id of ids) bad += await build(id);
console.log(bad ? `\n${bad} unroutable edge(s)\n` : "\nall edges routed through walkable space\n");
