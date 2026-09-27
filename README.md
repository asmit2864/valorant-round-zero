# Valo Assistant

Offline-first Valorant strategy blueprints for the ~90 seconds between competitive
games. Pick a map and ten agents, get ranked strategies with animated pathing on
the real minimap.

**No runtime AI, no API keys, no backend.** Strategies come from curated *set
pieces* whose role slots request capabilities (`smoke`, `entry`, `recon`, ...)
rather than named agents. A matcher assigns your actual five agents into those
slots at runtime, so ~400 set pieces cover all 366,671,500,650 map/side/comp
situations without enumerating any of them.

## First run

    npm install
    npm run data     # downloads maps, agents and art from valorant-api.com
    npm run dev

`npm run data` is required before the first build: game art is not committed, so
`public/assets/` is empty on a fresh clone.

## Commands

| command | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | typecheck, build, generate the service worker |
| `npm run validate` | graph connectivity, set-piece integrity, matcher output |
| `npm run data` | re-pull maps/agents from valorant-api.com and localize assets |
| `npx tsx scripts/smoke.tsx` | render every component + comp combination |

Run `npm run validate` and the smoke test after touching a graph or set piece.

## Deploying

Hosted on Cloudflare Workers as an assets-only deployment (no Worker script --
the app is fully static). `wrangler.jsonc` holds the config.

First time, once per machine:

    npm run cf:login
    npm run deploy

After that, pushing to `main` deploys automatically via
`.github/workflows/deploy.yml`, which also runs `validate` and the smoke test
first. That workflow needs two repo secrets:

| secret | where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard -> My Profile -> API Tokens -> Edit Cloudflare Workers template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard -> Workers & Pages, right-hand sidebar |

Game art is fetched during the deploy rather than committed, so a Riot patch
reaches production on the next push.

## Layout

    src/data/
      maps.generated.json     13 competitive maps, 300 callouts, minimap-normalized
      agents.generated.json   29 agents, local icon paths
      agent-capabilities.ts   capability tags + counter-notes (hand-authored)
      graphs/<map>.json       walkable adjacency graph
      setpieces/<map>.ts      strategy templates
    src/lib/
      graph.ts                A* over the callout graph
      matcher.ts              agent -> slot assignment and ranking
    src/app/                  React UI (Setup, Deck, Blueprint)

## Waypoint timing

A bare waypoint means "get there in your own time" and the leg is spread across
whatever phases are still free. Naming a phase pins that leg to that phase's
window:

    waypoints: [{ at: "Mid Link", phase: "setup" }, { at: "B Main", phase: "execute" }]

The gap between the two is a **hold** -- the player sits at Mid Link for the
whole of "control" and only moves on "execute". That is what makes fakes,
staggered executes and lurks read correctly: on a fake, the B group has to be
parked while A makes noise, not strolling across the map at constant speed.

Holds are drawn as a dashed ring around the agent.

## Adding a map

1. Author `src/data/graphs/<map>.json` — nodes come from `maps.generated.json`;
   add `extraNodes` for pro callouts Riot does not ship.
2. Author `src/data/setpieces/<map>.ts` — ~15 pieces per side, 5 slots each.
3. Register both in `src/lib/mapdata.ts`.
4. `npm run validate` — it fails on unknown callouts, unreachable nodes, and
   utility no eligible agent could actually use.

## Notes

- Riot ships callouts in world coordinates; `xMultiplier`/`yMultiplier` +
  `xScalarToAdd`/`yScalarToAdd` project them onto the minimap. Note the axis
  swap: world Y drives minimap X.
- Set pieces never name agents. If you find yourself wanting to, add a
  capability tag instead.
- Assets are downloaded and downscaled locally. Nothing may reference a remote
  URL at runtime — the app has to work with no signal.

Unofficial fan project, not endorsed by Riot Games.
