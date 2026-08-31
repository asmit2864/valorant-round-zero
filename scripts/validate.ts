/**
 * Structural validation for a map's graph + set pieces, plus a live matcher run.
 * Run: node scripts/validate.ts
 */
import { readFileSync } from "node:fs";
import { buildGraph, expandRoute, findPath } from "../src/lib/graph";
import { rankStrategies } from "../src/lib/matcher";
import { AGENT_CAPABILITIES } from "../src/data/agent-capabilities";
import { ASCENT_SET_PIECES } from "../src/data/setpieces/ascent";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const maps = read("../src/data/maps.generated.json");
const rawGraph = read("../src/data/graphs/ascent.json");

const ascent = maps.find((m: any) => m.id === "ascent");
const g = buildGraph(rawGraph, ascent.callouts);

let errors = 0;
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  errors++;
};

console.log("\n== graph ==");
console.log(`  nodes: ${g.nodes.size}  edges: ${[...g.adj.values()].reduce((n, a) => n + a.length, 0) / 2}`);

// 1. Every node reachable from attacker spawn, so no orphaned callouts.
const seen = new Set<string>(["Attacker Side Spawn"]);
const queue = ["Attacker Side Spawn"];
while (queue.length) {
  for (const { to } of g.adj.get(queue.shift()!) ?? []) {
    if (!seen.has(to)) { seen.add(to); queue.push(to); }
  }
}
const orphans = [...g.nodes.keys()].filter((n) => !seen.has(n));
if (orphans.length) fail(`unreachable nodes: ${orphans.join(", ")}`);
else console.log(`  connectivity: all ${g.nodes.size} nodes reachable`);

// 2. Suspiciously long edges usually mean a connection that crosses a wall.
const lengths: { edge: string; len: number }[] = [];
for (const [from, links] of g.adj) {
  for (const l of links) {
    if (from < l.to) {
      const a = g.nodes.get(from)!, b = g.nodes.get(l.to)!;
      lengths.push({ edge: `${from} -> ${l.to}`, len: Math.hypot(a.x - b.x, a.y - b.y) });
    }
  }
}
lengths.sort((a, b) => b.len - a.len);
const median = lengths[Math.floor(lengths.length / 2)].len;
const suspicious = lengths.filter((l) => l.len > median * 2.5);
console.log(`  edge length: median ${median.toFixed(3)}, longest ${lengths[0].len.toFixed(3)}`);
if (suspicious.length) console.log(`  REVIEW (>2.5x median, may cross a wall):\n${suspicious.map((s) => `      ${s.edge} (${s.len.toFixed(3)})`).join("\n")}`);

// 3. Every set piece waypoint and util callout must resolve to a real node.
console.log("\n== set pieces ==");
const attack = ASCENT_SET_PIECES.filter((p) => p.side === "attack").length;
console.log(`  ${ASCENT_SET_PIECES.length} pieces (${attack} attack, ${ASCENT_SET_PIECES.length - attack} defense)`);
for (const piece of ASCENT_SET_PIECES) {
  if (piece.slots.length !== 5) fail(`${piece.id}: ${piece.slots.length} slots, expected 5`);
  for (const slot of piece.slots) {
    for (const w of slot.waypoints) {
      try { findPath(g, w, w); } catch { fail(`${piece.id}/${slot.id}: unknown callout "${w}"`); }
    }
    try { expandRoute(g, slot.waypoints); }
    catch (e) { fail(`${piece.id}/${slot.id}: ${(e as Error).message}`); }
    for (const u of slot.util ?? []) {
      for (const c of [u.at, u.target]) {
        try { findPath(g, c, c); } catch { fail(`${piece.id}/${slot.id}: unknown util callout "${c}"`); }
      }
      // The slot must be able to attract an agent that actually owns this ability.
      const suppliers = Object.entries(AGENT_CAPABILITIES)
        .filter(([, c]) => c.tags.includes(u.tag) && slot.needs.some((n) => c.tags.includes(n)));
      if (!suppliers.length) fail(`${piece.id}/${slot.id}: no agent can both fill this slot and use "${u.tag}"`);
    }
  }
}
if (!errors) console.log("  all waypoints and utility resolve");

// 4. End-to-end: real comps through the matcher.
console.log("\n== matcher ==");
const comps: [string, string[], string[]][] = [
  ["meta double-controller", ["jett", "omen", "sova", "killjoy", "astra"], ["raze", "viper", "cypher", "skye", "chamber"]],
  ["no smoker at all", ["jett", "reyna", "sova", "killjoy", "sage"], ["neon", "omen", "fade", "cypher", "kay-o"]],
  ["all duelists", ["jett", "raze", "phoenix", "reyna", "yoru"], ["omen", "sova", "killjoy", "sage", "breach"]],
  ["new agents", ["waylay", "miks", "tejo", "veto", "vyse"], ["iso", "clove", "gekko", "deadlock", "harbor"]],
];
for (const [label, allies, enemies] of comps) {
  for (const side of ["attack", "defense"] as const) {
    const out = rankStrategies(g, ASCENT_SET_PIECES, allies, enemies, side, 3);
    if (!out.length) { fail(`${label}/${side}: no strategies returned`); continue; }
    const top = out[0];
    const unfilled = top.assignments.filter((a) => !a.agent).length;
    console.log(
      `  ${label.padEnd(24)} ${side.padEnd(8)} -> "${top.piece.name}" fit=${(top.fit * 100).toFixed(0)}% ` +
      `counter=${top.counter >= 0 ? "+" : ""}${(top.counter * 100).toFixed(0)}% ` +
      `gaps=${unfilled} route=${top.assignments[0].route.length}n`,
    );
  }
}

// 5. Show one full strategy so the output shape is eyeballable.
const demo = rankStrategies(g, ASCENT_SET_PIECES, ["jett", "omen", "sova", "killjoy", "kay-o"], ["viper", "cypher", "raze", "skye", "chamber"], "attack", 1)[0];
console.log(`\n== sample output ==\n  ${demo.piece.name}  (fit ${(demo.fit * 100).toFixed(0)}%)`);
console.log(`  ${demo.piece.premise}`);
for (const a of demo.assignments) {
  console.log(`   ${(a.agent ?? "-- UNFILLED").padEnd(10)} ${a.slot.label.padEnd(15)} ${a.route.map((n) => n.name).join(" > ")}`);
}
console.log("  watch out:");
for (const w of demo.watchOut.slice(0, 3)) console.log(`   ${w.agent}: ${w.note}`);

console.log(errors ? `\n${errors} ERROR(S)\n` : "\nVALIDATION PASSED\n");
process.exit(errors ? 1 : 0);
