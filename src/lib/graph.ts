export interface Node {
  name: string;
  x: number;
  y: number;
  approx?: boolean;
}

export interface MapGraph {
  map: string;
  nodes: Map<string, Node>;
  adj: Map<string, { to: string; cost: number; choke?: boolean }[]>;
  aliases: Record<string, string>;
  /** Where each side's routes begin. */
  spawns: Record<string, string>;
  /** Precomputed corridor shape per edge, keyed "A|B". See scripts/build-routes.ts. */
  corridors: Record<string, [number, number][]>;
  zones: Record<string, string[]>;
  plantSpots: { site: string; name: string; at: string; safeFrom: string[] }[];
  commonAnchors: string[];
}

type RawEdge = [string, string] | [string, string, { choke?: boolean; cost?: number }];

interface RawGraph {
  map: string;
  extraNodes: Node[];
  aliases: Record<string, string>;
  spawns: Record<string, string>;
  edges: RawEdge[];
  zones: Record<string, string[]>;
  plantSpots: MapGraph["plantSpots"];
  commonAnchors: string[];
}

const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);

/** `callouts` comes from maps.generated.json; passed in so this stays bundler-agnostic. */
export function buildGraph(
  raw: RawGraph,
  callouts: { name: string; x: number; y: number }[],
  corridors: Record<string, [number, number][]> = {},
): MapGraph {
  const nodes = new Map<string, Node>();
  for (const c of callouts) nodes.set(c.name, { name: c.name, x: c.x, y: c.y });
  for (const n of raw.extraNodes) nodes.set(n.name, n);

  const adj = new Map<string, { to: string; cost: number; choke?: boolean }[]>();
  const link = (a: string, b: string, cost: number, choke?: boolean) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, cost, choke });
  };

  for (const edge of raw.edges) {
    const [a, b, opts] = edge as [string, string, { choke?: boolean; cost?: number } | undefined];
    const na = nodes.get(a);
    const nb = nodes.get(b);
    if (!na || !nb) throw new Error(`edge references unknown node: ${a} -> ${b}`);
    // Geometric distance is the default cost, so A* naturally prefers short routes.
    const cost = opts?.cost ?? dist(na, nb);
    link(a, b, cost, opts?.choke);
    link(b, a, cost, opts?.choke);
  }

  return {
    map: raw.map,
    nodes,
    adj,
    aliases: raw.aliases ?? {},
    spawns: raw.spawns,
    corridors,
    zones: raw.zones,
    plantSpots: raw.plantSpots,
    commonAnchors: raw.commonAnchors,
  };
}

/** Resolve a pro callout to a graph node, tolerating the aliases players actually say. */
export function resolve(g: MapGraph, name: string): string {
  if (g.nodes.has(name)) return name;
  const alias = g.aliases[name];
  if (alias && g.nodes.has(alias)) return alias;
  throw new Error(`unknown callout on ${g.map}: ${name}`);
}

/**
 * A* between two callouts. Returns the full node sequence, so a set piece can
 * name only the waypoints that matter and the renderer still draws a legal route.
 */
export function findPath(g: MapGraph, fromName: string, toName: string): string[] {
  const from = resolve(g, fromName);
  const to = resolve(g, toName);
  if (from === to) return [from];

  const goal = g.nodes.get(to)!;
  const h = (n: string) => dist(g.nodes.get(n)!, goal);

  const open = new Set<string>([from]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[from, 0]]);
  const fScore = new Map<string, number>([[from, h(from)]]);

  while (open.size) {
    let current = "";
    let best = Infinity;
    for (const n of open) {
      const f = fScore.get(n) ?? Infinity;
      if (f < best) [best, current] = [f, n];
    }
    if (current === to) {
      const path = [current];
      while (cameFrom.has(path[0])) path.unshift(cameFrom.get(path[0])!);
      return path;
    }
    open.delete(current);
    for (const { to: nb, cost } of g.adj.get(current) ?? []) {
      const tentative = (gScore.get(current) ?? Infinity) + cost;
      if (tentative < (gScore.get(nb) ?? Infinity)) {
        cameFrom.set(nb, current);
        gScore.set(nb, tentative);
        fScore.set(nb, tentative + h(nb));
        open.add(nb);
      }
    }
  }
  throw new Error(`no path on ${g.map}: ${fromName} -> ${toName}`);
}

/**
 * The drawn shape of a route.
 *
 * A straight line between two callouts cuts through walls, so each edge carries
 * a precomputed polyline that follows the actual corridor. Falls back to the
 * straight segment only if an edge has no stored corridor.
 */
export function expandPolyline(g: MapGraph, nodeNames: string[]): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const push = (p: { x: number; y: number }) => {
    const last = pts[pts.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
  };

  if (nodeNames.length === 1) {
    const n = g.nodes.get(nodeNames[0])!;
    return [{ x: n.x, y: n.y }];
  }

  for (let i = 0; i < nodeNames.length - 1; i++) {
    const a = nodeNames[i];
    const b = nodeNames[i + 1];
    const corridor = g.corridors[`${a}|${b}`];
    if (corridor) {
      for (const [x, y] of corridor) push({ x, y });
    } else {
      const na = g.nodes.get(a)!;
      const nb = g.nodes.get(b)!;
      push({ x: na.x, y: na.y });
      push({ x: nb.x, y: nb.y });
    }
  }
  return pts;
}

/** Expand a set piece's waypoint list into a continuous, wall-legal route. */
export function expandRoute(g: MapGraph, waypoints: string[]): Node[] {
  const full: string[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const leg = findPath(g, waypoints[i], waypoints[i + 1]);
    full.push(...(i === 0 ? leg : leg.slice(1)));
  }
  if (waypoints.length === 1) full.push(resolve(g, waypoints[0]));
  return full.map((n) => g.nodes.get(n)!);
}
