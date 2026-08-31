import type { SetPiece, Slot, Side, Tag } from "../types";
import { AGENT_CAPABILITIES } from "../data/agent-capabilities";
import { expandRoute, type MapGraph, type Node } from "./graph";

export interface Assignment {
  slot: Slot;
  agent: string | null;
  score: number;
  /** Set when the comp has nobody who supplies what the slot asked for. */
  gap?: string;
  route: Node[];
}

export interface RankedStrategy {
  piece: SetPiece;
  assignments: Assignment[];
  fit: number;      // 0..1, how well our comp executes this
  counter: number;  // -1..1, how well it matches up against their comp
  total: number;
  warnings: string[];
  watchOut: { agent: string; note: string }[];
}

const NEED = 10;
const PREFER = 3;

/** How well one agent fills one slot. 0 means the agent supplies nothing the slot asked for. */
function scoreAgent(agentId: string, slot: Slot): number {
  const cap = AGENT_CAPABILITIES[agentId];
  if (!cap) return 0;

  const hits = slot.needs.filter((t) => cap.tags.includes(t)).length;
  if (hits === 0) return 0;

  let score = hits * NEED;
  score += (slot.prefer ?? []).filter((t) => cap.tags.includes(t)).length * PREFER;
  if (slot.weight) score += cap.power[slot.weight];

  // A slot asking for smokes should prefer the agent who has more of them.
  if (slot.needs.includes("smoke")) score += Math.min(cap.smokeCharges, 4);
  if (slot.needs.includes("flash")) score += Math.min(cap.flashCharges, 3);

  return score;
}

const ROSTER = Object.keys(AGENT_CAPABILITIES);
const ceilingCache = new Map<Slot, number>();

/** Best score any agent in the game could achieve in this slot. Comp-independent. */
function slotCeiling(slot: Slot): number {
  let cached = ceilingCache.get(slot);
  if (cached === undefined) {
    cached = Math.max(...ROSTER.map((a) => scoreAgent(a, slot)), NEED);
    ceilingCache.set(slot, cached);
  }
  return cached;
}

/**
 * Exact best assignment of 5 agents to 5 slots.
 * 5! = 120 permutations, so brute force is both optimal and instant - no need
 * for Hungarian here, and it keeps the code readable.
 */
function bestAssignment(agents: string[], slots: Slot[]): { pick: (string | null)[]; score: number } {
  const n = slots.length;
  let best: { pick: (string | null)[]; score: number } = { pick: Array(n).fill(null), score: -1 };

  const used = new Array(agents.length).fill(false);
  const current: (string | null)[] = Array(n).fill(null);

  const recurse = (slotIdx: number, running: number) => {
    if (slotIdx === n) {
      if (running > best.score) best = { pick: [...current], score: running };
      return;
    }
    let placedAny = false;
    for (let a = 0; a < agents.length; a++) {
      if (used[a]) continue;
      const s = scoreAgent(agents[a], slots[slotIdx]);
      if (s === 0) continue;
      placedAny = true;
      used[a] = true;
      current[slotIdx] = agents[a];
      recurse(slotIdx + 1, running + s);
      used[a] = false;
      current[slotIdx] = null;
    }
    // Nobody fits this slot - leave it empty and keep going, so a comp missing
    // (say) a smoker still gets the plan, with an explicit gap called out.
    if (!placedAny) {
      current[slotIdx] = null;
      recurse(slotIdx + 1, running);
    }
  };

  recurse(0, 0);

  // Any agent left over after the slots are filled still needs a job.
  return best;
}

function enemyTags(enemy: string[]): Set<Tag> {
  const tags = new Set<Tag>();
  for (const id of enemy) for (const t of AGENT_CAPABILITIES[id]?.tags ?? []) tags.add(t);
  return tags;
}

export function rankStrategies(
  graph: MapGraph,
  pieces: SetPiece[],
  allies: string[],
  enemies: string[],
  side: Side,
  limit = 6,
): RankedStrategy[] {
  const theirs = enemyTags(enemies);

  const ranked = pieces
    .filter((p) => p.side === side)
    .map<RankedStrategy>((piece) => {
      const { pick, score } = bestAssignment(allies, piece.slots);

      // Normalize against the best comp that COULD exist, not the one we have.
      // Using the roster-wide ideal is what makes a comp with no smoker score
      // badly on a smoke-dependent execute instead of trivially scoring 100%.
      const ceiling = piece.slots.reduce((sum, s) => sum + slotCeiling(s), 0);
      const fit = ceiling > 0 ? Math.min(score / ceiling, 1) : 0;

      const strong = piece.strongVs.filter((t) => theirs.has(t)).length;
      const weak = piece.weakVs.filter((t) => theirs.has(t)).length;
      const denom = piece.strongVs.length + piece.weakVs.length || 1;
      const counter = (strong - weak) / denom;

      const warnings: string[] = [];
      const assignments = piece.slots.map<Assignment>((slot, i) => {
        const agent = pick[i];
        if (!agent) {
          const gap = `No agent in your comp provides ${slot.needs.join(" or ")} - ${slot.label} is unfilled.`;
          warnings.push(gap);
          return { slot, agent: null, score: 0, gap, route: expandRoute(graph, slot.waypoints) };
        }
        return {
          slot,
          agent,
          score: scoreAgent(agent, slot),
          route: expandRoute(graph, slot.waypoints),
        };
      });

      const watchOut = enemies
        .map((id) => ({
          agent: id,
          note:
            side === "attack"
              ? AGENT_CAPABILITIES[id]?.counter.whenAttacking
              : AGENT_CAPABILITIES[id]?.counter.whenDefending,
        }))
        .filter((w): w is { agent: string; note: string } => Boolean(w.note));

      return { piece, assignments, fit, counter, total: fit * 0.7 + counter * 0.3, warnings, watchOut };
    })
    .sort((a, b) => b.total - a.total);

  return ranked.slice(0, limit);
}
