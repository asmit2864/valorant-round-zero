/**
 * Renders the real components outside a browser to catch runtime errors the
 * typechecker cannot see (bad data lookups, undefined routes, broken asset paths).
 * Run: npx tsx scripts/smoke.tsx
 */
import { renderToString } from "react-dom/server";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { App } from "../src/app/App";
import { Deck } from "../src/app/Deck";
import { MAPS, AGENTS, READY_MAPS, graphFor, piecesFor } from "../src/lib/mapdata";
import { rankStrategies } from "../src/lib/matcher";
import type { Side } from "../src/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;
const fail = (m: string) => { console.log(`  FAIL  ${m}`); errors++; };
const ok = (m: string) => console.log(`  ok    ${m}`);

console.log("\n== assets on disk ==");
let missing = 0;
for (const m of MAPS) {
  for (const p of [m.minimap, m.splash]) {
    if (!p.startsWith("/assets/") || !existsSync(join(ROOT, "public", p))) { missing++; fail(`missing ${p}`); }
  }
}
for (const a of AGENTS) {
  for (const p of [a.icon, a.portrait, ...a.abilities.map((x) => x.icon)]) {
    if (!p.startsWith("/assets/") || !existsSync(join(ROOT, "public", p))) { missing++; fail(`missing ${p}`); }
  }
}
if (!missing) ok(`all ${MAPS.length} maps + ${AGENTS.length} agents reference local files that exist`);

console.log("\n== component render ==");
try {
  const html = renderToString(<App />);
  if (!html.includes("Valo Assistant")) fail("App rendered without its heading");
  else ok(`setup screen renders (${(html.length / 1024).toFixed(1)} KB markup)`);
} catch (e) {
  fail(`App threw: ${(e as Error).message}`);
}

const COMPS: [string, string[], string[]][] = [
  ["meta", ["jett", "omen", "sova", "killjoy", "kay-o"], ["viper", "cypher", "raze", "skye", "chamber"]],
  ["all duelists", ["jett", "raze", "phoenix", "reyna", "yoru"], ["omen", "sova", "killjoy", "sage", "breach"]],
  ["no smoker", ["jett", "reyna", "sova", "killjoy", "sage"], ["neon", "omen", "fade", "cypher", "kay-o"]],
  ["new agents", ["waylay", "miks", "tejo", "veto", "vyse"], ["iso", "clove", "gekko", "deadlock", "harbor"]],
];

for (const mapId of READY_MAPS) {
  for (const side of ["attack", "defense"] as Side[]) {
    for (const [label, allies, enemies] of COMPS) {
      try {
        const html = renderToString(
          <Deck selection={{ mapId, side, allies, enemies }} onBack={() => {}} />,
        );
        if (!html.includes("<svg")) fail(`${mapId}/${side}/${label}: no blueprint SVG`);
        // A route that collapsed to nothing would render a pin at the origin.
        if (html.includes('d=""')) fail(`${mapId}/${side}/${label}: empty route path`);
      } catch (e) {
        fail(`${mapId}/${side}/${label}: ${(e as Error).message}`);
      }
    }
  }
}
if (!errors) ok(`Deck renders for ${READY_MAPS.length} map(s) x 2 sides x ${COMPS.length} comps`);

console.log("\n== regressions ==");
for (const mapId of READY_MAPS) {
  const g = graphFor(mapId);
  const pieces = piecesFor(mapId);
  for (const side of ["attack", "defense"] as Side[]) {
    const spawn = g.spawns[side];
    for (const [label, allies, enemies] of COMPS) {
      // Every route is drawn from spawn, so no path ever appears to begin mid-map.
      for (const s of rankStrategies(g, pieces, allies, enemies, side, 6)) {
        const offSpawn = s.assignments.filter((a) => a.route[0]?.name !== spawn);
        if (offSpawn.length) fail(`${s.piece.id}/${label}: ${offSpawn.length} route(s) do not start at ${spawn}`);
      }
      // All five players must be visible: pins may share a callout but never a
      // drawn position, or an agent is hidden underneath another.
      const html = renderToString(<Deck selection={{ mapId, side, allies, enemies }} onBack={() => {}} />);
      const cards = html.split("<article").length > 1 ? html.split("<article") : [html];
      const pins = [...cards[0].matchAll(/translate\(([-\d.]+) ([-\d.]+)\)/g)].map((m) => `${m[1]},${m[2]}`);
      if (pins.length && new Set(pins).size !== pins.length) {
        fail(`${mapId}/${side}/${label}: ${pins.length - new Set(pins).size} agent pin(s) hidden behind another`);
      }
    }
  }
}
// Corridors must actually be loaded, or every path silently reverts to
// straight lines through walls.
for (const mapId of READY_MAPS) {
  const g = graphFor(mapId);
  const corridorCount = Object.keys(g.corridors).length;
  if (!corridorCount) fail(`${mapId}: no corridors loaded, paths would cut through walls`);
  else {
    const bent = Object.values(g.corridors).filter((c) => c.length > 2).length;
    ok(`${mapId}: ${corridorCount / 2} edges have corridors, ${bent / 2} curve around geometry`);
  }
}
// A pin with no icon must be the explicit gap marker, never a bare disc that
// looks like a failed image.
for (const mapId of READY_MAPS) {
  for (const side of ["attack", "defense"] as Side[]) {
    for (const [label, allies, enemies] of COMPS) {
      const ranked = rankStrategies(graphFor(mapId), piecesFor(mapId), allies, enemies, side, 6);
      // Only the top strategy's blueprint is on screen, so only its gaps can be drawn.
      const gaps = ranked[0]?.assignments.filter((a) => !a.agent).length ?? 0;
      if (!gaps) continue;
      const html = renderToString(<Deck selection={{ mapId, side, allies, enemies }} onBack={() => {}} />);
      if (!html.includes("stroke-dasharray=\"6 5\"")) {
        fail(`${mapId}/${side}/${label}: ${gaps} unfilled slot(s) but no gap marker drawn`);
      }
    }
  }
}
if (!errors) ok("routes start at spawn; no agent pin is hidden behind another");

console.log("\n== coverage: every agent usable in every slot-set ==");
for (const mapId of READY_MAPS) {
  const g = graphFor(mapId);
  const pieces = piecesFor(mapId);
  const unusable: string[] = [];
  for (const agent of AGENTS) {
    // Give each agent four filler teammates and check it gets a job somewhere.
    const team = [agent.id, ...AGENTS.filter((a) => a.id !== agent.id).slice(0, 4).map((a) => a.id)];
    const got = (["attack", "defense"] as Side[]).some((side) =>
      rankStrategies(g, pieces, team, ["omen", "sova", "jett", "killjoy", "sage"], side, 6)
        .some((s) => s.assignments.some((a) => a.agent === agent.id)),
    );
    if (!got) unusable.push(agent.name);
  }
  if (unusable.length) fail(`${mapId}: never assigned -> ${unusable.join(", ")}`);
  else ok(`${mapId}: all ${AGENTS.length} agents get assigned a role`);
}

console.log(errors ? `\n${errors} ERROR(S)\n` : "\nSMOKE TEST PASSED\n");
process.exit(errors ? 1 : 0);
