import type { Waypoint } from "../types";
import { wpAt, wpPhase } from "../types";
import { findPath, expandPolyline, type MapGraph } from "./graph";

export interface Pt {
  x: number;
  y: number;
}

export interface Leg {
  /** Callouts this leg passes through, including both ends. */
  nodes: string[];
  /** Corridor-following shape for this leg. */
  points: Pt[];
  /** Fraction of the round this leg occupies. */
  t0: number;
  t1: number;
}

export interface TimedRoute {
  legs: Leg[];
  /** The whole path, for drawing the line. */
  points: Pt[];
  nodes: string[];
}

/**
 * Turns authored waypoints into legs with time windows.
 *
 * Phases divide the round into equal slices. A leg that names a phase takes
 * that slice; legs that name nothing are spread across the slices still free,
 * in order. The useful consequence is that a player whose last leg lands in an
 * early phase simply stops there and waits, which is how fakes, staggered
 * executes and lurks actually work.
 */
export function buildTimedRoute(
  graph: MapGraph,
  waypoints: Waypoint[],
  phaseIds: string[],
): TimedRoute {
  const n = Math.max(phaseIds.length, 1);
  const slice = (i: number): [number, number] => [i / n, (i + 1) / n];

  // Expand each authored leg separately: A* may insert intermediate callouts,
  // but the whole sub-path is still one timed movement.
  const raw = waypoints.slice(1).map((w, i) => {
    const from = wpAt(waypoints[i]);
    const to = wpAt(w);
    const nodes = findPath(graph, from, to);
    return { nodes, points: expandPolyline(graph, nodes), phase: wpPhase(w) };
  });

  if (!raw.length) {
    const only = wpAt(waypoints[0]);
    const node = graph.nodes.get(only)!;
    return { legs: [], points: [{ x: node.x, y: node.y }], nodes: [only] };
  }

  // Claim the slices that legs asked for by name.
  const windows = new Array<[number, number] | null>(raw.length).fill(null);
  const claimed = new Set<number>();
  raw.forEach((leg, i) => {
    if (!leg.phase) return;
    const p = phaseIds.indexOf(leg.phase);
    if (p === -1) return;
    windows[i] = slice(p);
    claimed.add(p);
  });

  // Undeclared legs fill the gap between their neighbouring declared legs, and
  // only that gap. Letting them spread over every free slice would push a
  // declared leg later than the phase it explicitly asked for.
  for (let i = 0; i < windows.length; ) {
    if (windows[i]) { i++; continue; }
    let j = i;
    while (j < windows.length && !windows[j]) j++;
    const lower = i === 0 ? 0 : windows[i - 1]![1];
    const upper = j < windows.length ? windows[j]![0] : 1;
    const span = Math.max(upper - lower, 0.001);
    const each = span / (j - i);
    for (let k = i; k < j; k++) windows[k] = [lower + each * (k - i), lower + each * (k - i + 1)];
    i = j;
  }

  let cursor = 0;
  const legs: Leg[] = raw.map((leg, i) => {
    const [t0, t1] = windows[i] ?? [cursor, Math.min(1, cursor + 1 / n)];
    // Never let a later leg start before an earlier one finished.
    const start = Math.max(t0, cursor);
    const end = Math.max(start + 0.001, t1);
    cursor = end;
    return { nodes: leg.nodes, points: leg.points, t0: start, t1: end };
  });

  const nodes: string[] = [];
  const points: Pt[] = [];
  for (const leg of legs) {
    for (const nd of leg.nodes) if (nodes[nodes.length - 1] !== nd) nodes.push(nd);
    for (const p of leg.points) {
      const last = points[points.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) points.push(p);
    }
  }
  return { legs, points, nodes };
}

function alongPolyline(points: Pt[], f: number): Pt {
  if (points.length === 1) return points[0];
  const segs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  if (total === 0) return points[0];
  let travel = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (travel <= segs[i]) {
      const r = segs[i] === 0 ? 0 : travel / segs[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * r,
        y: points[i].y + (points[i + 1].y - points[i].y) * r,
      };
    }
    travel -= segs[i];
  }
  return points[points.length - 1];
}

/** Where this player is at time t, and whether they are currently holding. */
export function positionAt(route: TimedRoute, t: number): { pt: Pt; holding: boolean } {
  if (!route.legs.length) return { pt: route.points[0], holding: true };

  const first = route.legs[0];
  if (t <= first.t0) return { pt: first.points[0], holding: true };

  for (const leg of route.legs) {
    if (t >= leg.t0 && t <= leg.t1) {
      return { pt: alongPolyline(leg.points, (t - leg.t0) / (leg.t1 - leg.t0)), holding: false };
    }
  }

  // Between legs, or past the end: parked wherever the last finished leg left them.
  let last = route.legs[0];
  for (const leg of route.legs) if (leg.t1 <= t) last = leg;
  return { pt: last.points[last.points.length - 1], holding: true };
}
