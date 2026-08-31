import type { AgentCapability } from "../types";

/**
 * Hand-authored capability profile for every playable agent (29 as of Aug 2026).
 *
 * This is what lets ~400 set pieces cover all 366,671,500,650 map/side/comp
 * situations: set pieces ask for capabilities, this table says who supplies them.
 * Ability names verified against valorant-api.com; keep in sync when Riot ships
 * a rework or a new agent.
 */
export const AGENT_CAPABILITIES: Record<string, AgentCapability> = {
  // ---------------------------------------------------------------- Duelists
  jett: {
    role: "Duelist",
    tags: ["entry", "movement", "miniSmoke", "boost", "opPick"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 3, info: 0, anchor: 1, postplant: 0, support: 0 },
    counter: {
      whenAttacking: "Updraft angles above you. Clear Heaven and high boxes before committing.",
      whenDefending: "Dash beats your reaction, not your crosshair. Hold wide, off the common dash line.",
    },
  },
  raze: {
    role: "Duelist",
    tags: ["entry", "movement", "boost", "molly", "postplant", "recon"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 3, info: 1, anchor: 1, postplant: 2, support: 0 },
    counter: {
      whenAttacking: "Never stack in a tight corner. Nade and Showstopper punish grouped players.",
      whenDefending: "Boombot flushes close angles. Play back off the choke and hold the retake.",
    },
  },
  phoenix: {
    role: "Duelist",
    tags: ["entry", "flash", "wall", "molly", "heal"],
    smokeCharges: 0,
    flashCharges: 2,
    power: { entry: 3, info: 0, anchor: 1, postplant: 1, support: 1 },
    counter: {
      whenAttacking: "Wall splits the choke. Expect a solo duel on the near half.",
      whenDefending: "Run It Back is a free first look. Trade the clone, do not chase it.",
    },
  },
  reyna: {
    role: "Duelist",
    tags: ["entry", "flash", "heal", "lurk"],
    smokeCharges: 0,
    flashCharges: 2,
    power: { entry: 3, info: 0, anchor: 1, postplant: 0, support: 0 },
    counter: {
      whenAttacking: "She has no team utility. Deny the first kill and the round stalls.",
      whenDefending: "Do not feed solo kills. Every trade denies a Dismiss reset.",
    },
  },
  yoru: {
    role: "Duelist",
    tags: ["entry", "flash", "teleport", "lurk", "movement"],
    smokeCharges: 0,
    flashCharges: 2,
    power: { entry: 2, info: 1, anchor: 1, postplant: 0, support: 0 },
    counter: {
      whenAttacking: "Expect a teleport behind your line. Keep one player watching flank at all times.",
      whenDefending: "Footsteps may be a Fakeout. Confirm with utility before rotating off site.",
    },
  },
  neon: {
    role: "Duelist",
    tags: ["entry", "movement", "wall", "concuss"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 3, info: 0, anchor: 1, postplant: 0, support: 1 },
    counter: {
      whenAttacking: "Her walls cut your rotation, not just her entry. Rotate early or not at all.",
      whenDefending: "Sprint compresses your reaction window. Hold close angles, not long ones.",
    },
  },
  iso: {
    role: "Duelist",
    tags: ["entry", "suppress", "wall", "molly", "lurk"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 3, info: 0, anchor: 1, postplant: 1, support: 0 },
    counter: {
      whenAttacking: "Undercut suppresses through walls. Do not pre-load utility at the choke.",
      whenDefending: "His shield eats your first bullet. Isolate him or trade instantly.",
    },
  },
  waylay: {
    role: "Duelist",
    tags: ["entry", "movement", "slow"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 3, info: 0, anchor: 1, postplant: 0, support: 0 },
    counter: {
      whenAttacking: "Refract gives her a free retreat. A won duel may not mean a won pick.",
      whenDefending: "Saturate hinders you before the fight. Back off the choke rather than duel slowed.",
    },
  },

  // -------------------------------------------------------------- Initiators
  sova: {
    role: "Initiator",
    tags: ["recon", "molly", "postplant"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 1, info: 3, anchor: 1, postplant: 3, support: 2 },
    counter: {
      whenAttacking: "Break the drone and the dart. His lineups only work on confirmed positions.",
      whenDefending: "Assume your default position is known. Rotate off it after the first dart.",
    },
  },
  breach: {
    role: "Initiator",
    tags: ["flash", "concuss", "molly"],
    smokeCharges: 0,
    flashCharges: 2,
    power: { entry: 1, info: 0, anchor: 1, postplant: 1, support: 3 },
    counter: {
      whenAttacking: "Fault Line stuns through walls. Play off the choke, not inside it.",
      whenDefending: "His flashes come through terrain. Turning away is not enough, reposition.",
    },
  },
  skye: {
    role: "Initiator",
    tags: ["flash", "recon", "heal"],
    smokeCharges: 0,
    flashCharges: 3,
    power: { entry: 1, info: 3, anchor: 1, postplant: 0, support: 3 },
    counter: {
      whenAttacking: "Shoot the dog and the bird. Both are destructible and both are the plan.",
      whenDefending: "Trailblazer confirms your position before contact. Do not hold a stale angle.",
    },
  },
  "kay-o": {
    role: "Initiator",
    tags: ["flash", "suppress", "molly", "recon", "revive"],
    smokeCharges: 0,
    flashCharges: 2,
    power: { entry: 1, info: 2, anchor: 1, postplant: 2, support: 3 },
    counter: {
      whenAttacking: "Knife suppression turns your sentinel setup off. Hold utility until after it lands.",
      whenDefending: "NULL/cmd means your abilities are gone for the execute. Win it on positioning.",
    },
  },
  fade: {
    role: "Initiator",
    tags: ["recon", "flash", "slow"],
    smokeCharges: 0,
    flashCharges: 1,
    power: { entry: 1, info: 3, anchor: 1, postplant: 0, support: 3 },
    counter: {
      whenAttacking: "Haunt reveals through smoke. Shoot the eye immediately or move off the mark.",
      whenDefending: "Prowlers track to your real position. Break line of sight, do not just back up.",
    },
  },
  gekko: {
    role: "Initiator",
    tags: ["flash", "concuss", "molly", "postplant"],
    smokeCharges: 0,
    flashCharges: 1,
    power: { entry: 2, info: 2, anchor: 1, postplant: 2, support: 3 },
    counter: {
      whenAttacking: "His utility is reusable. Trading one Dizzy does not buy you the round.",
      whenDefending: "Wingman can plant solo. Watch the spike, not only the players.",
    },
  },
  tejo: {
    role: "Initiator",
    tags: ["recon", "suppress", "concuss", "molly", "postplant"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 1, info: 3, anchor: 1, postplant: 3, support: 3 },
    counter: {
      whenAttacking: "Drone suppresses and reveals in one pulse. Kill it before it pings you.",
      whenDefending: "Guided Salvo lands on map coordinates, not line of sight. Default positions are unsafe.",
    },
  },

  // ------------------------------------------------------------- Controllers
  brimstone: {
    role: "Controller",
    tags: ["smoke", "molly", "postplant", "boost"],
    smokeCharges: 3,
    flashCharges: 0,
    power: { entry: 0, info: 0, anchor: 2, postplant: 3, support: 3 },
    counter: {
      whenAttacking: "His smokes are map-placed and instant. Fake first, execute after they commit.",
      whenDefending: "Molly plus Orbital Strike denies a default plant. Plant tight or off-default.",
    },
  },
  omen: {
    role: "Controller",
    tags: ["smoke", "flash", "teleport", "lurk"],
    smokeCharges: 2,
    flashCharges: 1,
    power: { entry: 1, info: 0, anchor: 2, postplant: 1, support: 3 },
    counter: {
      whenAttacking: "Expect a one-way or a teleport behind you. Clear your own backline before planting.",
      whenDefending: "From the Shadows repositions him mid-round. A cleared angle is not cleared.",
    },
  },
  astra: {
    role: "Controller",
    tags: ["smoke", "concuss", "wall"],
    smokeCharges: 4,
    flashCharges: 0,
    power: { entry: 0, info: 1, anchor: 2, postplant: 1, support: 3 },
    counter: {
      whenAttacking: "Stars are pre-placed. Watch where they go in the first 15 seconds to read the setup.",
      whenDefending: "Cosmic Divide cuts sound and vision. Commit to one side of the wall, do not straddle it.",
    },
  },
  viper: {
    role: "Controller",
    tags: ["smoke", "wall", "molly", "postplant", "anchor"],
    smokeCharges: 1,
    flashCharges: 0,
    power: { entry: 0, info: 0, anchor: 3, postplant: 3, support: 2 },
    counter: {
      whenAttacking: "Fuel is finite. Bait the wall early, execute on the second half of the round.",
      whenDefending: "Snakebite plus Pit makes a default plant undefusable. Retake before the wall lands.",
    },
  },
  harbor: {
    role: "Controller",
    tags: ["wall", "smoke", "slow"],
    smokeCharges: 1,
    flashCharges: 0,
    power: { entry: 0, info: 0, anchor: 2, postplant: 1, support: 3 },
    counter: {
      whenAttacking: "His walls are curved and bullet-permeable. Spray through the water line.",
      whenDefending: "High Tide covers a whole entry. Play retake, not first contact.",
    },
  },
  clove: {
    role: "Controller",
    tags: ["smoke", "molly", "revive", "heal"],
    smokeCharges: 2,
    flashCharges: 0,
    power: { entry: 1, info: 0, anchor: 2, postplant: 1, support: 2 },
    counter: {
      whenAttacking: "They can smoke after dying. Killing the controller does not open the site.",
      whenDefending: "Not Dead Yet means a five-for-four is not won. Clear that position again.",
    },
  },
  miks: {
    role: "Controller",
    tags: ["smoke", "concuss", "heal", "boost"],
    smokeCharges: 3,
    flashCharges: 0,
    power: { entry: 1, info: 0, anchor: 2, postplant: 1, support: 3 },
    counter: {
      whenAttacking: "M-pulse concusses a whole choke. Enter off-angle or wait it out.",
      whenDefending: "Harmonize stims two players at once. Expect a faster push than the comp suggests.",
    },
  },

  // ---------------------------------------------------------------- Sentinels
  sage: {
    role: "Sentinel",
    tags: ["wall", "slow", "heal", "revive", "anchor"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 0, info: 0, anchor: 3, postplant: 1, support: 3 },
    counter: {
      whenAttacking: "Break the wall early. The damage is free and it exposes the anchor behind it.",
      whenDefending: "Resurrect undoes your opening pick. Push the numbers advantage immediately.",
    },
  },
  cypher: {
    role: "Sentinel",
    tags: ["trap", "recon", "miniSmoke", "anchor"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 0, info: 3, anchor: 3, postplant: 1, support: 2 },
    counter: {
      whenAttacking: "Clear trips before the execute, not during it. Assume the camera has already seen you.",
      whenDefending: "Neural Theft gives up your whole team position. Trade the body fast or reposition.",
    },
  },
  killjoy: {
    role: "Sentinel",
    tags: ["trap", "recon", "molly", "postplant", "anchor"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 0, info: 2, anchor: 3, postplant: 3, support: 2 },
    counter: {
      whenAttacking: "Her utility has a leash range. Force her off site and the setup dies with her.",
      whenDefending: "Lockdown forces a retake you may not win. Break the ultimate or leave the site early.",
    },
  },
  chamber: {
    role: "Sentinel",
    tags: ["trap", "teleport", "anchor", "opPick", "slow"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 0, info: 1, anchor: 3, postplant: 0, support: 1 },
    counter: {
      whenAttacking: "Do not peek the long angle first. Flash or smoke it, then take the space.",
      whenDefending: "He teleports out of lost duels. Do not over-rotate to a kill you did not confirm.",
    },
  },
  deadlock: {
    role: "Sentinel",
    tags: ["trap", "concuss", "blockPath", "slow", "anchor"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 0, info: 2, anchor: 3, postplant: 1, support: 2 },
    counter: {
      whenAttacking: "Walk the choke. Sonic Sensor triggers on noise, and mesh only blocks bodies.",
      whenDefending: "GravNet forces you to crouch mid-entry. Hold the angle, do not chase into it.",
    },
  },
  vyse: {
    role: "Sentinel",
    tags: ["trap", "flash", "slow", "anchor"],
    smokeCharges: 0,
    flashCharges: 1,
    power: { entry: 0, info: 2, anchor: 3, postplant: 1, support: 2 },
    counter: {
      whenAttacking: "Shear walls spawn behind you and split the entry. Enter as a tight pair, not a line.",
      whenDefending: "Steel Garden jams your primary. Have a sidearm plan or break contact.",
    },
  },
  veto: {
    role: "Sentinel",
    tags: ["utilDestroy", "teleport", "trap", "anchor"],
    smokeCharges: 0,
    flashCharges: 0,
    power: { entry: 0, info: 1, anchor: 3, postplant: 1, support: 2 },
    counter: {
      whenAttacking: "Interceptor eats your execute utility. Bait it with one ability before committing the rest.",
      whenDefending: "Crosscut lets them reposition instantly. A flank cleared once will not stay clear.",
    },
  },
};
