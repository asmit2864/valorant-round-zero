/**
 * Pulls maps + agents from valorant-api.com and emits app-ready JSON.
 *
 * The important bit is the coordinate transform. Riot ships callouts in world
 * coordinates; the map record carries four constants that project them onto the
 * minimap image as 0..1 normalized values. Note the axis swap -- world Y drives
 * minimap X and vice versa. Verified against Ascent: A Site lands top-left.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const API = "https://valorant-api.com/v1";

/** Maps with a tacticalDescription are the standard-competitive ones. */
const isCompetitiveMap = (m) => Boolean(m.tacticalDescription) && (m.callouts?.length ?? 0) > 0;

function toMinimap(location, map) {
  return {
    x: round(location.y * map.xMultiplier + map.xScalarToAdd),
    y: round(location.x * map.yMultiplier + map.yScalarToAdd),
  };
}

const round = (n) => Math.round(n * 10000) / 10000;

/** "A" + "Main" -> "A Main"; standalone regions keep their bare name. */
function calloutName(c) {
  const sr = c.superRegionName?.trim();
  const rn = c.regionName?.trim();
  if (!sr || sr === rn) return rn;
  return `${sr} ${rn}`;
}

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()).data;
}

const maps = (await get("/maps"))
  .filter(isCompetitiveMap)
  .map((m) => ({
    id: slug(m.displayName),
    uuid: m.uuid,
    name: m.displayName,
    sites: m.tacticalDescription,
    minimap: m.displayIcon,
    splash: m.splash,
    // kept so the transform can be re-derived or debugged later
    transform: {
      xMultiplier: m.xMultiplier,
      yMultiplier: m.yMultiplier,
      xScalarToAdd: m.xScalarToAdd,
      yScalarToAdd: m.yScalarToAdd,
    },
    callouts: dedupe(
      m.callouts.map((c) => ({
        name: calloutName(c),
        region: c.superRegionName ?? null,
        ...toMinimap(c.location, m),
      })),
    ),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** A couple of maps ship duplicate region names; keep the first, it is canonical. */
function dedupe(callouts) {
  const seen = new Set();
  return callouts.filter((c) => (seen.has(c.name) ? false : seen.add(c.name)));
}

const agents = (await get("/agents?isPlayableCharacter=true"))
  .map((a) => ({
    id: slug(a.displayName),
    uuid: a.uuid,
    name: a.displayName,
    role: a.role?.displayName ?? "Unknown",
    icon: a.displayIconSmall ?? a.displayIcon,
    portrait: a.fullPortrait,
    abilities: a.abilities
      .filter((ab) => ab.slot !== "Passive")
      .map((ab) => ({
        slot: ab.slot,
        name: ab.displayName,
        icon: ab.displayIcon,
      })),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

mkdirSync(OUT, { recursive: true });
write("maps.generated.json", maps);
write("agents.generated.json", agents);

function write(file, data) {
  writeFileSync(join(OUT, file), JSON.stringify(data, null, 2) + "\n");
  console.log(`  ${file.padEnd(26)} ${data.length} entries`);
}

console.log(`\n${maps.length} competitive maps, ${agents.length} agents`);
console.log(`callouts total: ${maps.reduce((n, m) => n + m.callouts.length, 0)}`);
