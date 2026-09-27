import { useMemo } from "react";
import type { RankedStrategy } from "../lib/matcher";
import { AGENT_BY_ID, type MapRecord } from "../lib/mapdata";

export const LANE = ["#ff4655", "#00e0c6", "#ffb648", "#8b7bff", "#4ade80"];
const S = 1000;

type Pt = { x: number; y: number };

/** Catmull-Rom, so routes read as drawn lines rather than polygons. */
function smooth(nodes: Pt[]): string {
  const p = nodes.map((n) => ({ x: n.x * S, y: n.y * S }));
  if (p.length < 2) return "";
  if (p.length === 2) return `M${p[0].x},${p[0].y} L${p[1].x},${p[1].y}`;
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6}` +
         ` ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Position along a route at normalized progress t, by cumulative segment length. */
function pointAt(nodes: Pt[], t: number): Pt {
  if (!nodes.length) return { x: 0, y: 0 };
  if (nodes.length === 1) return { x: nodes[0].x * S, y: nodes[0].y * S };
  const pts = nodes.map((n) => ({ x: n.x * S, y: n.y * S }));
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  if (total === 0) return pts[0];
  let travel = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (travel <= segs[i]) {
      const f = segs[i] === 0 ? 0 : travel / segs[i];
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    travel -= segs[i];
  }
  return pts[pts.length - 1];
}

/**
 * Slots routinely end at the same callout (three players staging in A Main is a
 * normal plan), and stacked pins hide each other completely. Fan any coincident
 * pins out around their shared point so all five players are always visible.
 */
function decollide(points: ({ x: number; y: number } | null)[]): ({ x: number; y: number } | null)[] {
  const CELL = 34;
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    if (!p) return;
    const key = `${Math.round(p.x / CELL)},${Math.round(p.y / CELL)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });

  const out = [...points];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const radius = 15 + members.length * 4;
    members.forEach((idx, n) => {
      const angle = (n / members.length) * Math.PI * 2 - Math.PI / 2;
      out[idx] = {
        x: points[idx]!.x + Math.cos(angle) * radius,
        y: points[idx]!.y + Math.sin(angle) * radius,
      };
    });
  }
  return out;
}

const UTIL_GLYPH: Record<string, string> = {
  smoke: "◍", miniSmoke: "◌", wall: "▬", blockPath: "▭", flash: "✸", concuss: "◎",
  recon: "◈", suppress: "⊘", utilDestroy: "✕", molly: "▲", slow: "≈", trap: "⊙",
  heal: "✚", revive: "✚", teleport: "⇢", boost: "▲", postplant: "▲", anchor: "■",
};

interface Props {
  strategy: RankedStrategy;
  map: MapRecord;
  /** 0..1 through the round. */
  t: number;
  /** null shows everyone; an index isolates that one player. */
  focus: number | null;
}

export function Blueprint({ strategy, map, t, focus }: Props) {
  const phases = strategy.piece.phases;
  const phaseStart = useMemo(() => {
    const m = new Map<string, number>();
    phases.forEach((p, i) => m.set(p.id, i / phases.length));
    return m;
  }, [phases]);

  // Positions are resolved for the whole team before drawing, because whether a
  // pin needs nudging depends on where the other four are.
  const pins = useMemo(
    () => decollide(strategy.assignments.map((a) => (a.polyline.length ? pointAt(a.polyline, t) : null))),
    [strategy, t],
  );

  return (
    <svg className="bp" viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${map.name} blueprint`}>
      <image href={map.minimap} x="0" y="0" width={S} height={S} opacity="0.8" />
      <rect width={S} height={S} fill="#0b0e13" opacity="0.42" />

      {strategy.assignments.map((a, i) => {
        if (focus !== null && focus !== i) return null;
        if (!a.polyline.length) return null;
        const color = LANE[i % LANE.length];
        const d = smooth(a.polyline);
        const now = pins[i] ?? pointAt(a.polyline, t);
        const anchor = pointAt(a.polyline, t);
        const agent = a.agent ? AGENT_BY_ID.get(a.agent) : null;

        return (
          <g key={a.slot.id}>
            <path d={d} className="bp-shadow" />
            <path d={d} stroke={color} className="bp-route" />
            <circle cx={a.polyline[0].x * S} cy={a.polyline[0].y * S} r={7} fill={color} opacity={0.55} />

            {(a.slot.util ?? []).map((u, ui) => {
              const start = phaseStart.get(u.phase) ?? 0;
              if (t < start) return null;
              const target = a.route.find((n) => n.name === u.target);
              const from = a.route.find((n) => n.name === u.at) ?? a.route[0];
              const at = target ?? from;
              return (
                <g key={ui} className="bp-util">
                  <circle cx={at.x * S} cy={at.y * S} r={15} fill={color} opacity={0.18} />
                  <circle cx={at.x * S} cy={at.y * S} r={15} fill="none" stroke={color} strokeWidth={2} opacity={0.85} />
                  <text x={at.x * S} y={at.y * S + 6} textAnchor="middle" fill={color} fontSize={17}>
                    {UTIL_GLYPH[u.tag] ?? "•"}
                  </text>
                </g>
              );
            })}

            {(now.x !== anchor.x || now.y !== anchor.y) && (
              <line x1={anchor.x} y1={anchor.y} x2={now.x} y2={now.y} stroke={color} strokeWidth={2} opacity={0.5} />
            )}
            <g transform={`translate(${now.x} ${now.y})`} className="bp-pin">
              <circle r={22} fill={color} />
              {agent && (
                <>
                  <clipPath id={`clip-${strategy.piece.id}-${i}`}>
                    <circle r={19} />
                  </clipPath>
                  <image href={agent.icon} x={-19} y={-19} width={38} height={38} clipPath={`url(#clip-${strategy.piece.id}-${i})`} />
                </>
              )}
              <circle r={22} fill="none" stroke="#0b0e13" strokeWidth={3} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
