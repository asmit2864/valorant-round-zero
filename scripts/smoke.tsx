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
