/** Capability vocabulary the matcher reasons over. Set pieces request these; agents supply them. */
export type Tag =
  | "smoke"        // full, persistent vision block placeable at range
  | "miniSmoke"    // short/small vision block (Cypher cage, Jett cloud)
  | "wall"         // long linear blocker (Sage, Viper, Neon, Harbor, Iso)
  | "blockPath"    // blocks movement but not vision (Deadlock mesh)
  | "flash"        // blind / nearsight
  | "concuss"      // stun, daze, deafen
  | "recon"        // reveals enemy positions
  | "suppress"     // disables enemy abilities
  | "utilDestroy"  // removes enemy utility from the field
  | "entry"        // takes first contact and space
  | "movement"     // dash / satchel / speed
  | "teleport"
  | "boost"        // elevates the team's position or tempo (updraft, stim)
  | "trap"         // placed detection or denial that holds ground while you look elsewhere
  | "molly"        // damage-over-time zone
  | "slow"
  | "postplant"    // can deny a defuse from safety
  | "anchor"       // holds a site alone credibly
  | "lurk"         // operates alone off the main group
  | "heal"
  | "revive"
  | "opPick";      // reliable long-angle opening pick

export type Role = "Duelist" | "Initiator" | "Controller" | "Sentinel";

/** 0 = none, 3 = best in class. Used to break ties when several agents fit a slot. */
export interface Power {
  entry: 0 | 1 | 2 | 3;
  info: 0 | 1 | 2 | 3;
  anchor: 0 | 1 | 2 | 3;
  postplant: 0 | 1 | 2 | 3;
  support: 0 | 1 | 2 | 3;
}

export interface AgentCapability {
  role: Role;
  tags: Tag[];
  /** Vision-blocking charges available per round, before the ultimate. */
  smokeCharges: number;
  flashCharges: number;
  power: Power;
  /** Surfaced as "watch out for" lines when this agent is on the ENEMY team. */
  counter: {
    /** You are attacking; they are defending with this agent. */
    whenAttacking: string;
    /** You are defending; they are attacking with this agent. */
    whenDefending: string;
  };
}

// ---------------------------------------------------------------- set pieces

export type Side = "attack" | "defense";
export type Econ = "full-buy" | "eco" | "force" | "bonus";

export interface UtilAction {
  /** Which capability is spent. Must be a tag the assigned agent actually has. */
  tag: Tag;
  /** Callout the ability is used from. */
  at: string;
  /** Callout it lands on. */
  target: string;
  phase: string;
  note?: string;
}

/**
 * A point on a slot's route.
 *
 * A bare string means "get there in your own time" and the leg is spread across
 * whatever phases are still free. Naming a phase pins the leg to that phase's
 * window, which is what makes holds possible: if one leg lands in "control" and
 * the next in "execute", the player sits still for the whole gap between them.
 */
export type Waypoint = string | { at: string; phase: string };

export const wpAt = (w: Waypoint): string => (typeof w === "string" ? w : w.at);
export const wpPhase = (w: Waypoint): string | undefined => (typeof w === "string" ? undefined : w.phase);

export interface Slot {
  id: string;
  label: string;
  /** Any-of: an agent scores for this slot if it has at least one of these. */
  needs: Tag[];
  /** Soft bonuses that break ties between otherwise-equal fits. */
  prefer?: Tag[];
  /** Power stat used as the final tiebreak. */
  weight?: keyof Power;
  waypoints: Waypoint[];
  util?: UtilAction[];
  note: string;
}

export interface SetPiece {
  id: string;
  map: string;
  side: Side;
  econ: Econ[];
  name: string;
  premise: string;
  difficulty: 1 | 2 | 3;
  phases: { id: string; label: string; clock: string }[];
  slots: Slot[];
  /** Enemy capabilities this plan punishes / struggles against. */
  strongVs: Tag[];
  weakVs: Tag[];
}
