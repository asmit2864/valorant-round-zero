import mapsJson from "../data/maps.generated.json";
import agentsJson from "../data/agents.generated.json";
import ascentGraph from "../data/graphs/ascent.json";
import ascentRoutes from "../data/routes/ascent.json";
import { ASCENT_SET_PIECES } from "../data/setpieces/ascent";
import { buildGraph, type MapGraph } from "./graph";
import type { SetPiece } from "../types";

export interface MapRecord {
  id: string;
  name: string;
  sites: string;
  minimap: string;
  splash: string;
  callouts: { name: string; x: number; y: number }[];
}

export interface AgentRecord {
  id: string;
  name: string;
  role: string;
  icon: string;
  portrait: string;
  abilities: { slot: string; name: string; icon: string }[];
}

export const MAPS = mapsJson as unknown as MapRecord[];
export const AGENTS = agentsJson as unknown as AgentRecord[];

export const AGENT_BY_ID = new Map(AGENTS.map((a) => [a.id, a]));
export const MAP_BY_ID = new Map(MAPS.map((m) => [m.id, m]));

/** Maps with a graph + set pieces authored. The rest are shown as coming soon. */
const CONTENT: Record<string, { raw: unknown; routes: unknown; pieces: SetPiece[] }> = {
  ascent: { raw: ascentGraph, routes: ascentRoutes, pieces: ASCENT_SET_PIECES },
};

export const READY_MAPS = Object.keys(CONTENT);
export const isReady = (mapId: string) => mapId in CONTENT;

const graphCache = new Map<string, MapGraph>();

export function graphFor(mapId: string): MapGraph {
  let g = graphCache.get(mapId);
  if (!g) {
    const entry = CONTENT[mapId];
    if (!entry) throw new Error(`no content for map: ${mapId}`);
    g = buildGraph(entry.raw as never, MAP_BY_ID.get(mapId)!.callouts, entry.routes as never);
    graphCache.set(mapId, g);
  }
  return g;
}

export const piecesFor = (mapId: string): SetPiece[] => CONTENT[mapId]?.pieces ?? [];

export const ROLE_ORDER = ["Duelist", "Initiator", "Controller", "Sentinel"];
