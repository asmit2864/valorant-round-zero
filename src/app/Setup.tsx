import { useState } from "react";
import { MAPS, AGENTS, AGENT_BY_ID, ROLE_ORDER, isReady } from "../lib/mapdata";
import type { Side } from "../types";

export interface Selection {
  mapId: string;
  side: Side;
  allies: string[];
  enemies: string[];
}

type Target = { team: "allies" | "enemies"; index: number } | null;

interface Props {
  initial: Selection;
  recent: Selection[];
  onGo: (s: Selection) => void;
}

export function Setup({ initial, recent, onGo }: Props) {
  const [mapId, setMapId] = useState(initial.mapId);
  const [side, setSide] = useState<Side>(initial.side);
  const [allies, setAllies] = useState<string[]>(initial.allies);
  const [enemies, setEnemies] = useState<string[]>(initial.enemies);
  const [picking, setPicking] = useState<Target>(null);

  const ready = allies.filter(Boolean).length === 5 && enemies.filter(Boolean).length === 5 && isReady(mapId);
  const taken = new Set([...allies, ...enemies].filter(Boolean));

  function choose(id: string) {
    if (!picking) return;
    const setter = picking.team === "allies" ? setAllies : setEnemies;
    const list = picking.team === "allies" ? allies : enemies;
    const next = [...list];
    next[picking.index] = id;
    setter(next);
    // Auto-advance to the next empty slot so filling five agents is five taps.
    const nextEmpty = next.findIndex((v) => !v);
    setPicking(nextEmpty === -1 ? null : { team: picking.team, index: nextEmpty });
  }

  const Slots = ({ team, list }: { team: "allies" | "enemies"; list: string[] }) => (
    <div className="slots">
      {list.map((id, i) => {
        const a = id ? AGENT_BY_ID.get(id) : null;
        const active = picking?.team === team && picking.index === i;
        return (
          <button
            key={i}
            className={`slot ${active ? "active" : ""} ${a ? "filled" : ""}`}
            onClick={() => setPicking(active ? null : { team, index: i })}
            aria-label={a ? a.name : `Empty ${team} slot ${i + 1}`}
          >
            {a ? <img src={a.icon} alt="" /> : <span>+</span>}
          </button>
        );
      })}
      {list.some(Boolean) && (
        <button
          className="clear"
          onClick={() => (team === "allies" ? setAllies(["", "", "", "", ""]) : setEnemies(["", "", "", "", ""]))}
        >
          clear
        </button>
      )}
    </div>
  );

  return (
    <div className="setup">
      <header className="apphead">
        <h1>Valo Assistant</h1>
        <p>Pick the map and ten agents. Strategies are instant and work offline.</p>
      </header>

      {recent.length > 0 && (
        <section>
          <h2>Recent</h2>
          <div className="recents">
            {recent.map((r, i) => (
              <button key={i} className="recent" onClick={() => onGo(r)}>
                <strong>{MAPS.find((m) => m.id === r.mapId)?.name}</strong>
                <span>{r.side}</span>
                <div className="mini">
                  {r.allies.map((a) => {
                    const ag = AGENT_BY_ID.get(a);
                    return ag ? <img key={a} src={ag.icon} alt="" /> : null;
                  })}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Map</h2>
        <div className="maps">
          {MAPS.map((m) => (
            <button
              key={m.id}
              className={`map ${mapId === m.id ? "active" : ""} ${isReady(m.id) ? "" : "soon"}`}
              onClick={() => isReady(m.id) && setMapId(m.id)}
              disabled={!isReady(m.id)}
            >
              <img src={m.splash} alt="" loading="lazy" />
              <span>{m.name}</span>
              {!isReady(m.id) && <em>soon</em>}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Side</h2>
        <div className="seg">
          {(["attack", "defense"] as const).map((s) => (
            <button key={s} className={side === s ? "active" : ""} onClick={() => setSide(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Your team</h2>
        <Slots team="allies" list={allies} />
        <h2>Their team</h2>
        <Slots team="enemies" list={enemies} />
      </section>

      {picking && (
        <div className="picker" role="dialog" aria-label="Choose an agent">
          <div className="picker-head">
            <strong>{picking.team === "allies" ? "Your team" : "Their team"}</strong>
            <button onClick={() => setPicking(null)}>done</button>
          </div>
          <div className="picker-body">
            {ROLE_ORDER.map((role) => (
              <div key={role}>
                <h3>{role}</h3>
                <div className="agrid">
                  {AGENTS.filter((a) => a.role === role).map((a) => (
                    <button
                      key={a.id}
                      className={`ag ${taken.has(a.id) ? "taken" : ""}`}
                      onClick={() => choose(a.id)}
                      disabled={taken.has(a.id)}
                    >
                      <img src={a.icon} alt="" loading="lazy" />
                      <span>{a.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cta">
        <button disabled={!ready} onClick={() => onGo({ mapId, side, allies, enemies })}>
          {ready ? "Get strategies" : `Pick ${10 - taken.size} more agent${10 - taken.size === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
